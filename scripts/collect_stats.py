"""Aggregate-only collection. No credentials or responses are logged."""
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from urllib.parse import quote, urlparse
from zoneinfo import ZoneInfo

REPORTS = {
    'daily': (['date'], ['screenPageViews', 'activeUsers', 'sessions']),
    'channel': (['sessionDefaultChannelGroup'], ['sessions']),
    'source': (['sessionSourceMedium'], ['sessions']),
    'pages': (['hostName', 'pagePath'], ['screenPageViews']),
    'region': (['region'], ['activeUsers']),
    'device': (['deviceCategory'], ['sessions']),
    'link_clicks': (['customEvent:link_domain'], ['eventCount']),
}

def report_body(section, days):
    dimensions, metrics = REPORTS[section]
    body = {'dateRanges': [{'startDate': f'{days}daysAgo', 'endDate': 'yesterday'}],
            'dimensions': [{'name': x} for x in dimensions],
            'metrics': [{'name': x} for x in metrics], 'limit': '100000',
            'orderBys': [{'metric': {'metricName': metrics[0]}, 'desc': True}]}
    if section == 'link_clicks':
        body['dimensionFilter'] = {'andGroup': {'expressions': [
            {'filter': {'fieldName': 'eventName', 'stringFilter': {'matchType': 'EXACT', 'value': 'click'}}},
            {'filter': {'fieldName': 'customEvent:link_domain', 'inListFilter': {'values': [
                'naver.me', 'pf.kakao.com', 'talk.naver.com', 'blog.naver.com']}}}
        ]}}
    return body

def normalize(report):
    return [{'dimensions': [d['value'] for d in row.get('dimensionValues', [])],
             'metrics': [float(m['value']) for m in row['metricValues']]}
            for row in report.get('rows', [])]

def collect(google, now):
    snapshots = []
    stamp = now.isoformat()
    ga_url = 'https://analyticsdata.googleapis.com/v1beta/properties/549414473:runReport'
    sc_url = 'https://www.googleapis.com/webmasters/v3/sites/' + quote('sc-domain:ansansdental.com', safe='') + '/searchAnalytics/query'
    def post(url, body):
        response = google.post(url, json=body, timeout=90)
        if not response.ok:
            raise RuntimeError(f'Google API HTTP {response.status_code}')
        return response.json()
    for days in (7, 28, 90):
        # GA date ranges use the property timezone returned in report metadata.
        end = now.astimezone(ZoneInfo('Asia/Seoul')).date() - timedelta(days=1)
        start = end - timedelta(days=days-1)
        for section in REPORTS:
            body = report_body(section, days)
            report = post(ga_url, body)
            if section == 'daily':
                end = now.astimezone(ZoneInfo(report.get('metadata', {}).get('timeZone', 'Asia/Seoul'))).date() - timedelta(days=1)
                start = end - timedelta(days=days-1)
            rows = normalize(report)
            if report.get('rowCount', 0) > len(rows):
                raise RuntimeError('GA report exceeded supported row limit')
            payload = {'rows': rows, 'startDate': str(start), 'endDate': str(end)}
            if section == 'daily':
                # activeUsers must be deduplicated for the whole period, never summed daily.
                total_body = {k: v for k, v in body.items() if k not in ('dimensions', 'orderBys')}
                totals = normalize(post(ga_url, total_body))
                payload['totals'] = totals[0]['metrics'] if totals else [0, 0, 0]
            snapshots.append({'period': f'd{days}', 'section': section, 'payload': payload, 'updated_at': stamp})
        sc_end = now.astimezone(ZoneInfo('America/Los_Angeles')).date() - timedelta(days=1)
        sc_start = sc_end - timedelta(days=days-1)
        search = post(sc_url, {'startDate': str(sc_start), 'endDate': str(sc_end),
                             'dimensions': ['query'], 'rowLimit': 20, 'dataState': 'final'})
        rows = [{'dimensions': r['keys'], 'metrics': [r['clicks'], r['impressions'], r['ctr'], r['position']]}
                for r in search.get('rows', [])]
        snapshots.append({'period': f'd{days}', 'section': 'search_queries',
                          'payload': {'rows': rows, 'startDate': str(sc_start), 'endDate': str(sc_end)}, 'updated_at': stamp})
    return snapshots

def main():
    from google.oauth2 import service_account
    from google.auth.transport.requests import AuthorizedSession
    import requests
    credentials = service_account.Credentials.from_service_account_info(
        json.loads(os.environ['GOOGLE_SA_JSON']), scopes=[
            'https://www.googleapis.com/auth/analytics.readonly',
            'https://www.googleapis.com/auth/webmasters.readonly'])
    url = os.environ['SUPABASE_URL'].rstrip('/')
    parsed = urlparse(url)
    if parsed.scheme != 'https' or not parsed.hostname or not parsed.hostname.endswith('.supabase.co') or parsed.path:
        raise RuntimeError('Invalid Supabase URL')
    key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
    with AuthorizedSession(credentials) as google:
        snapshots = collect(google, datetime.now(timezone.utc))
    # One batch only after all reports succeed: failures preserve the previous snapshot.
    response = requests.post(url + '/rest/v1/stats_snapshots?on_conflict=period,section',
                             headers={'apikey': key, 'Authorization': 'Bearer ' + key,
                                      'Prefer': 'resolution=merge-duplicates'}, json=snapshots, timeout=90)
    if not response.ok:
        raise RuntimeError(f'Supabase HTTP {response.status_code}')
    print('Updated 24 aggregate snapshots.')

if __name__ == '__main__':
    try:
        main()
    except Exception:
        # Provider exceptions may contain credential material; do not print exception text.
        print('Collection failed. Check API permissions, secrets and schema; previous snapshots retained.', file=sys.stderr)
        sys.exit(1)
