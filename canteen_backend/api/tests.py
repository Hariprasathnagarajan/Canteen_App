"""
VDart Cafe Automated Test Suite
Covers:
  1. Authentication & Sessions
  2. Role-Based Access Control (RBAC)
  3. Token Allocation & Management
  4. Ordering Transactions & Atomic Balance Deductions
  5. Kitchen Workflow & Automated Token Refunds
  6. Password Reset Security (Self-service + Admin Approval)
  7. Admin Dashboard Analytics & Reporting
"""
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from api.models import (
    CustomUser, MenuItem, Order, OrderItem,
    ShiftTokenAllocation, TokenDistribution, PasswordResetRequest
)


# ---------------------------------------------------------
# Base test setup - shared fixtures for all test classes
# ---------------------------------------------------------
class VDartCafeBaseTestCase(APITestCase):
    def setUp(self):
        self.client = APIClient()

        self.admin = CustomUser.objects.create_superuser(
            username="admin_test", user_id="ADM001", email="admin@vdartcafe.com",
            password="AdminPassword123!", role="admin",
        )
        self.staff = CustomUser.objects.create_user(
            username="staff_test", user_id="STF001", email="staff@vdartcafe.com",
            password="StaffPassword123!", role="staff",
        )
        self.employee = CustomUser.objects.create_user(
            username="emp_test", user_id="EMP001", email="emp@vdartcafe.com",
            password="EmpPassword123!", role="employee", work_shift="day", monthly_tokens=50,
        )
        self.guest = CustomUser.objects.create_user(
            username="guest_test", user_id="GST001", email="guest@vdartcafe.com",
            password="GuestPassword123!", role="guest", work_shift="day", monthly_tokens=30,
        )
        self.coffee = MenuItem.objects.create(
            name="Test Coffee", description="Fresh hot coffee",
            price=5, is_available=True,
        )
        self.sandwich = MenuItem.objects.create(
            name="Test Sandwich", description="Crispy grilled sandwich",
            price=15, is_available=True,
        )
        self.unavailable = MenuItem.objects.create(
            name="Special Cake", description="Seasonal cake",
            price=20, is_available=False,
        )


# ---------------------------------------------------------
# 1. Authentication & Sessions
# ---------------------------------------------------------
class AuthenticationTests(VDartCafeBaseTestCase):

    def test_login_success(self):
        resp = self.client.post("/api/login/", {"username": "emp_test", "password": "EmpPassword123!"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["username"], "emp_test")
        self.assertEqual(resp.data["role"], "employee")

    def test_login_wrong_password_rejected(self):
        resp = self.client.post("/api/login/", {"username": "emp_test", "password": "wrong!"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_profile_requires_authentication(self):
        resp = self.client.get("/api/profile/")
        self.assertIn(resp.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_profile_returns_correct_user_data(self):
        self.client.force_authenticate(user=self.employee)
        resp = self.client.get("/api/profile/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["username"], "emp_test")
        self.assertEqual(resp.data["tokens"], 50)

    def test_logout_returns_success(self):
        self.client.force_authenticate(user=self.employee)
        resp = self.client.post("/api/logout/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------
# 2. Role-Based Access Control
# ---------------------------------------------------------
class RBACTests(VDartCafeBaseTestCase):

    def test_employee_cannot_access_admin_users_list(self):
        self.client.force_authenticate(user=self.employee)
        resp = self.client.get("/api/admin/users/")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_access_admin_users_list(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/admin/users/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_staff_can_list_kitchen_orders(self):
        self.client.force_authenticate(user=self.staff)
        resp = self.client.get("/api/staff/orders/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_employee_cannot_list_kitchen_orders(self):
        self.client.force_authenticate(user=self.employee)
        resp = self.client.get("/api/staff/orders/")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


# ---------------------------------------------------------
# 3. Token Allocation & Management
# ---------------------------------------------------------
class TokenAllocationTests(VDartCafeBaseTestCase):

    def test_new_night_shift_user_gets_100_tokens_automatically(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post("/api/admin/users/", {
            "username": "night_emp", "user_id": "EMP099", "email": "night@vdartcafe.com",
            "password": "Night123!", "role": "employee", "work_shift": "night",
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        created_user = CustomUser.objects.get(username="night_emp")
        self.assertEqual(created_user.monthly_tokens, 100)
        self.assertEqual(created_user.user_id, "EMP099")

    def test_assign_tokens_updates_user_balance_and_creates_audit_trail(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post("/api/admin/tokens/assign/", {"shift": "day", "tokens": 65})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.monthly_tokens, 65)
        # Audit trail record exists
        self.assertTrue(TokenDistribution.objects.filter(user=self.employee, tokens_allocated=65).exists())

    def test_admin_token_summary(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/admin/tokens/summary/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("day_shift", resp.data)

    def test_assign_tokens_all_shifts(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post("/api/admin/tokens/assign/", {"shift": "all"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.monthly_tokens, 50)  # Day shift baseline 50
        self.guest.refresh_from_db()
        self.assertEqual(self.guest.monthly_tokens, 50)  # Guest day shift baseline 50


# ---------------------------------------------------------
# 4. Ordering Transactions
# ---------------------------------------------------------
class OrderingTransactionTests(VDartCafeBaseTestCase):

    def test_employee_place_valid_order_deducts_tokens(self):
        self.client.force_authenticate(user=self.employee)
        resp = self.client.post("/api/employee/order/", {
            "items": [
                {"menu_item_id": self.coffee.id, "quantity": 2},    # 2 * 5 = 10 tokens
                {"menu_item_id": self.sandwich.id, "quantity": 1},  # 1 * 15 = 15 tokens
            ]
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["total_tokens"], 25)
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.monthly_tokens, 25)   # 50 - 25

    def test_order_rejected_on_insufficient_tokens(self):
        self.client.force_authenticate(user=self.employee)
        resp = self.client.post("/api/employee/order/", {
            "items": [{"menu_item_id": self.sandwich.id, "quantity": 4}]  # 4 * 15 = 60 > 50
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.monthly_tokens, 50)   # unchanged
        self.assertEqual(Order.objects.filter(user=self.employee).count(), 0)

    def test_order_rejected_for_negative_quantity(self):
        self.client.force_authenticate(user=self.employee)
        resp = self.client.post("/api/employee/order/", {
            "items": [{"menu_item_id": self.coffee.id, "quantity": -1}]
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_order_rejected_for_zero_quantity(self):
        self.client.force_authenticate(user=self.employee)
        resp = self.client.post("/api/employee/order/", {
            "items": [{"menu_item_id": self.coffee.id, "quantity": 0}]
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_order_rejected_for_unavailable_item(self):
        self.client.force_authenticate(user=self.employee)
        resp = self.client.post("/api/employee/order/", {
            "items": [{"menu_item_id": self.unavailable.id, "quantity": 1}]
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_guest_can_place_order(self):
        self.client.force_authenticate(user=self.guest)
        resp = self.client.post("/api/guest/order/", {
            "items": [{"menu_item_id": self.coffee.id, "quantity": 1}]
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.guest.refresh_from_db()
        self.assertEqual(self.guest.monthly_tokens, 25)  # 30 - 5


# ---------------------------------------------------------
# 5. Kitchen Workflow & Token Refunds
# ---------------------------------------------------------
class KitchenWorkflowTests(VDartCafeBaseTestCase):

    def setUp(self):
        super().setUp()
        self.order = Order.objects.create(
            user=self.employee, total_tokens=10,
            status="pending",
        )
        OrderItem.objects.create(
            order=self.order, menu_item=self.coffee,
            quantity=2, tokens_per_item=5,
        )
        self.employee.monthly_tokens = 40
        self.employee.save()

    def _update(self, new_status):
        return self.client.patch(
            f"/api/staff/orders/{self.order.id}/update_status/",
            {"status": new_status},
            format="json"
        )

    def test_approve_pending_order(self):
        self.client.force_authenticate(user=self.staff)
        resp = self._update("approved")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, "approved")

    def test_mark_approved_order_completed(self):
        self.order.status = "approved"
        self.order.save()
        self.client.force_authenticate(user=self.staff)
        resp = self._update("completed")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, "completed")

    def test_decline_pending_order_refunds_tokens_atomically(self):
        self.client.force_authenticate(user=self.staff)
        resp = self._update("declined")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.order.refresh_from_db()
        self.assertTrue(self.order.tokens_refunded)
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.monthly_tokens, 50)   # 40 + 10 restored

    def test_double_decline_blocked_no_duplicate_refund(self):
        self.client.force_authenticate(user=self.staff)
        self._update("declined")
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.monthly_tokens, 50)

        resp = self._update("declined")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.monthly_tokens, 50)   # still 50, no extra refund

    def test_cannot_revert_completed_order_to_pending(self):
        self.order.status = "completed"
        self.order.save()
        self.client.force_authenticate(user=self.staff)
        resp = self._update("pending")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------
# 6. Password Reset Security
# ---------------------------------------------------------
class PasswordResetSecurityTests(VDartCafeBaseTestCase):

    # Public self-service reset
    def test_employee_can_self_service_reset(self):
        resp = self.client.post("/api/password_reset/", {
            "identifier": "emp_test", "email": "emp@vdartcafe.com",
            "new_password": "FreshPass123!", "confirm_password": "FreshPass123!",
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.employee.refresh_from_db()
        self.assertTrue(self.employee.check_password("FreshPass123!"))

    def test_admin_blocked_from_self_service_reset(self):
        resp = self.client.post("/api/password_reset/", {
            "identifier": "admin_test", "email": "admin@vdartcafe.com",
            "new_password": "Hacked999!", "confirm_password": "Hacked999!",
        })
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Admin accounts cannot", resp.data["error"])

    def test_wrong_email_rejected_from_self_service_reset(self):
        resp = self.client.post("/api/password_reset/", {
            "identifier": "emp_test", "email": "hacker@wrong.com",
            "new_password": "FreshPass123!", "confirm_password": "FreshPass123!",
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    # Admin-approval reset request
    def test_employee_can_submit_reset_request(self):
        resp = self.client.post("/api/password_reset/request/", {
            "identifier": "emp_test", "email": "emp@vdartcafe.com", "reason": "Forgot password",
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(PasswordResetRequest.objects.filter(user=self.employee, status="pending").exists())

    def test_admin_blocked_from_submitting_reset_request(self):
        resp = self.client.post("/api/password_reset/request/", {
            "identifier": "admin_test", "email": "admin@vdartcafe.com", "reason": "Takeover",
        })
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Admin accounts cannot", resp.data["error"])

    def test_admin_approves_reset_password_becomes_employee_id(self):
        req = PasswordResetRequest.objects.create(user=self.employee, reason="Reset", status="pending")
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(f"/api/admin/password-resets/{req.id}/approve/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        req.refresh_from_db()
        self.assertEqual(req.status, "approved")
        self.employee.refresh_from_db()
        self.assertTrue(self.employee.check_password("EMP001"))   # password = user_id

    def test_admin_rejects_reset_request(self):
        req = PasswordResetRequest.objects.create(user=self.employee, reason="Reset", status="pending")
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(f"/api/admin/password-resets/{req.id}/reject/", {"notes": "Not now"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        req.refresh_from_db()
        self.assertEqual(req.status, "rejected")

    def test_cannot_approve_already_approved_request(self):
        req = PasswordResetRequest.objects.create(user=self.employee, reason="Reset", status="approved")
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(f"/api/admin/password-resets/{req.id}/approve/")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Cannot approve", resp.data["error"])

    def test_cannot_reject_already_rejected_request(self):
        req = PasswordResetRequest.objects.create(user=self.employee, reason="Reset", status="rejected")
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(f"/api/admin/password-resets/{req.id}/reject/")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Cannot reject", resp.data["error"])

    def test_check_password_reset_status(self):
        PasswordResetRequest.objects.create(user=self.employee, reason="Reset", status="pending")
        resp = self.client.get("/api/password_reset/status/?identifier=emp_test")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["has_request"])
        self.assertEqual(resp.data["status"], "pending")


# ---------------------------------------------------------
# 7. Admin Dashboard Analytics
# ---------------------------------------------------------
class DashboardAnalyticsTests(VDartCafeBaseTestCase):

    def setUp(self):
        super().setUp()
        Order.objects.create(
            user=self.employee, total_tokens=20,
            status="completed",
        )

    def test_dashboard_stats_returns_expected_fields(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/admin/dashboard/stats/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        for field in ["totalUsers", "totalEmployees", "totalMenuItems", "todaysRevenue", "pendingOrders"]:
            self.assertIn(field, resp.data, f"Missing field: {field}")

    def test_dashboard_user_count_includes_all_roles(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/admin/dashboard/stats/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(resp.data["totalUsers"], 4)

    def test_recent_orders_endpoint(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/admin/dashboard/orders/recent/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIsInstance(resp.data, list)

    def test_revenue_data_endpoint(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/admin/dashboard/revenue/?period=week")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIsInstance(resp.data, list)

    def test_non_admin_cannot_access_dashboard(self):
        self.client.force_authenticate(user=self.employee)
        resp = self.client.get("/api/admin/dashboard/stats/")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
