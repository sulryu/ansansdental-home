import unittest
from datetime import datetime, timezone
from collect_stats import collect, report_body

class Response:
    ok = True
    def __init__(self, body): self.body = body
    def json(self): return self.body

class Google:
    def post(self, url, json, timeout):
        if 'searchAnalytics' in url:
            return Response({'rows': [{'keys': ['치과'], 'clicks': 2, 'impressions': 9, 'ctr': 2/9, 'position': 3}]})
        dimensions = json.get('dimensions', [])
        dims = [{'value': '20261006' if d['name'] == 'date' else 'test'} for d in dimensions]
        return Response({'rows': [{'dimensionValues': dims, 'metricValues': [{'value': '12'} for m in json['metrics']]}], 'rowCount': 1, 'metadata': {'timeZone': 'Asia/Seoul'}})

class StatsTests(unittest.TestCase):
    def test_full_batch_and_dates(self):
        rows = collect(Google(), datetime(2026, 10, 7, 2, tzinfo=timezone.utc))
        self.assertEqual(len(rows), 24)
        self.assertEqual(len({(r['period'], r['section']) for r in rows}), 24)
        daily = next(r['payload'] for r in rows if r['period'] == 'd7' and r['section'] == 'daily')
        self.assertEqual((daily['startDate'], daily['endDate']), ('2026-09-30', '2026-10-06'))
        self.assertEqual(daily['totals'], [12, 12, 12])
        search = next(r['payload'] for r in rows if r['period'] == 'd7' and r['section'] == 'search_queries')
        self.assertEqual(search['endDate'], '2026-10-05')
    def test_click_allowlist(self):
        filters = report_body('link_clicks', 7)['dimensionFilter']['andGroup']['expressions']
        self.assertEqual(filters[0]['filter']['stringFilter']['value'], 'click')
        self.assertEqual(len(filters[1]['filter']['inListFilter']['values']), 4)
    def test_api_failure_aborts_batch(self):
        class Failed(Google):
            def post(self, *args, **kwargs):
                response = Response({}); response.ok = False; response.status_code = 403; return response
        with self.assertRaises(RuntimeError): collect(Failed(), datetime.now(timezone.utc))

if __name__ == '__main__': unittest.main()
