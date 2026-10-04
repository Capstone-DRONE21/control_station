import unittest

from fastapi.testclient import TestClient

from app.main import app


class HealthTests(unittest.TestCase):
    def test_health(self):
        with TestClient(app) as client:
            response = client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")
        self.assertIn("service", response.json())

    def test_unknown_endpoint(self):
        with TestClient(app) as client:
            self.assertEqual(client.get("/api/missing").status_code, 404)
