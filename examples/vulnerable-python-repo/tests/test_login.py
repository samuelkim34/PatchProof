import unittest
from login import authenticate
class AuthTests(unittest.TestCase):
    def test_normal(self): self.assertTrue(authenticate('admin','demo-password-123'))
