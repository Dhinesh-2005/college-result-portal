#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class CollegeResultPortalTester:
    def __init__(self, base_url="https://gradeview-3.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            self.failed_tests.append({"test": name, "details": details})
            print(f"❌ {name} - FAILED: {details}")

    def test_health_check(self):
        """Test basic API health"""
        try:
            response = requests.get(f"{self.api_url}/health", timeout=10)
            success = response.status_code == 200
            self.log_test("Health Check", success, f"Status: {response.status_code}")
            return success
        except Exception as e:
            self.log_test("Health Check", False, str(e))
            return False

    def test_admin_login(self):
        """Test admin login with correct credentials"""
        try:
            response = requests.post(
                f"{self.api_url}/login",
                json={"username": "admin", "password": "12345"},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if "token" in data and data.get("otp_required") == False:
                    self.token = data["token"]
                    self.log_test("Admin Login (OTP Skipped)", True, "Token received")
                    return True
                else:
                    self.log_test("Admin Login", False, "Token not received or OTP required")
                    return False
            else:
                self.log_test("Admin Login", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Admin Login", False, str(e))
            return False

    def test_admin_login_invalid(self):
        """Test admin login with invalid credentials"""
        try:
            response = requests.post(
                f"{self.api_url}/login",
                json={"username": "wrong", "password": "wrong"},
                timeout=10
            )
            success = response.status_code == 401
            self.log_test("Admin Login (Invalid Credentials)", success, f"Status: {response.status_code}")
            return success
        except Exception as e:
            self.log_test("Admin Login (Invalid Credentials)", False, str(e))
            return False

    def test_protected_route_without_token(self):
        """Test protected route without token"""
        try:
            response = requests.post(
                f"{self.api_url}/admin/save",
                json={
                    "rollNo": "TEST001",
                    "name": "Test Student",
                    "dob": "2000-01-01",
                    "course": "B.E. Computer Science Engineering",
                    "subjects": [{"code": "CS101", "semester": "1", "grade": "A"}]
                },
                timeout=10
            )
            success = response.status_code == 401
            self.log_test("Protected Route (No Token)", success, f"Status: {response.status_code}")
            return success
        except Exception as e:
            self.log_test("Protected Route (No Token)", False, str(e))
            return False

    def test_save_student_result(self):
        """Test saving student result"""
        if not self.token:
            self.log_test("Save Student Result", False, "No token available")
            return False
            
        try:
            student_data = {
                "rollNo": "TEST001",
                "name": "Test Student",
                "dob": "2000-01-01",
                "course": "B.E. Computer Science Engineering",
                "subjects": [
                    {"code": "CS101", "semester": "1", "grade": "A"},
                    {"code": "CS102", "semester": "1", "grade": "B+"},
                    {"code": "CS103", "semester": "1", "grade": "F"}
                ]
            }
            
            response = requests.post(
                f"{self.api_url}/admin/save?token={self.token}",
                json=student_data,
                timeout=10
            )
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                details += f", Message: {response.json().get('message', '')}"
            
            self.log_test("Save Student Result", success, details)
            return success
        except Exception as e:
            self.log_test("Save Student Result", False, str(e))
            return False

    def test_get_student_result(self):
        """Test retrieving student result"""
        try:
            response = requests.get(
                f"{self.api_url}/student/result?rollNo=TEST001&dob=2000-01-01",
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if "rollNo" in data and data["rollNo"] == "TEST001":
                    # Check Pass/Fail logic
                    results = data.get("results", [])
                    pass_fail_correct = True
                    for subject in results:
                        grade = subject.get("grade", "")
                        status = subject.get("status", "")
                        expected_status = "Pass" if grade.upper() in ["O", "A+", "A", "B+", "B", "C"] else "Fail"
                        if status != expected_status:
                            pass_fail_correct = False
                            break
                    
                    if pass_fail_correct:
                        self.log_test("Get Student Result & Pass/Fail Logic", True, "Result retrieved with correct Pass/Fail logic")
                        return True
                    else:
                        self.log_test("Get Student Result & Pass/Fail Logic", False, "Pass/Fail logic incorrect")
                        return False
                else:
                    self.log_test("Get Student Result", False, "Student data not found or incorrect")
                    return False
            else:
                self.log_test("Get Student Result", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Get Student Result", False, str(e))
            return False

    def test_get_nonexistent_student(self):
        """Test retrieving non-existent student result"""
        try:
            response = requests.get(
                f"{self.api_url}/student/result?rollNo=NONEXISTENT&dob=1999-01-01",
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                success = "message" in data and "No result found" in data["message"]
                self.log_test("Get Non-existent Student", success, f"Response: {data}")
                return success
            else:
                self.log_test("Get Non-existent Student", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Get Non-existent Student", False, str(e))
            return False

    def test_token_verification(self):
        """Test token verification endpoint"""
        if not self.token:
            self.log_test("Token Verification", False, "No token available")
            return False
            
        try:
            response = requests.get(
                f"{self.api_url}/verify-token?token={self.token}",
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                success = data.get("valid") == True
                self.log_test("Token Verification", success, f"Valid: {data.get('valid')}")
                return success
            else:
                self.log_test("Token Verification", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Token Verification", False, str(e))
            return False

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting College Result Portal Backend Tests")
        print(f"🌐 Testing API at: {self.api_url}")
        print("=" * 60)
        
        # Test sequence
        self.test_health_check()
        self.test_admin_login_invalid()
        self.test_protected_route_without_token()
        self.test_admin_login()
        
        if self.token:
            self.test_token_verification()
            self.test_save_student_result()
            self.test_get_student_result()
            self.test_get_nonexistent_student()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.failed_tests:
            print("\n❌ Failed Tests:")
            for test in self.failed_tests:
                print(f"  - {test['test']}: {test['details']}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"✨ Success Rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    tester = CollegeResultPortalTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())