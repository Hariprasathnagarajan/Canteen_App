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
from django.core.files.uploadedfile import SimpleUploadedFile
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

    def test_new_user_starts_with_zero_tokens(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post("/api/admin/users/", {
            "username": "night_emp", "user_id": "EMP099", "email": "night@vdartcafe.com",
            "password": "Night123!", "role": "employee", "work_shift": "night",
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        created_user = CustomUser.objects.get(username="night_emp")
        # Tokens are never auto-allocated — the admin allocates explicitly
        self.assertEqual(created_user.monthly_tokens, 0)
        self.assertEqual(created_user.user_id, "EMP099")

    def test_assign_tokens_updates_user_balance_and_creates_audit_trail(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post("/api/admin/tokens/assign/", {"shift": "day", "tokens": 65})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.monthly_tokens, 65)
        # Audit trail record exists
        self.assertTrue(TokenDistribution.objects.filter(user=self.employee, tokens_allocated=65).exists())

    def test_assign_tokens_requires_explicit_amount(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post("/api/admin/tokens/assign/", {"shift": "day"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.monthly_tokens, 50)  # unchanged

    def test_assign_all_shifts_requires_explicit_amounts(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post("/api/admin/tokens/assign/", {"shift": "all"})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_token_summary(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/admin/tokens/summary/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("day_shift", resp.data)
        day_users = resp.data["day_shift"]["users"]
        employee_row = next((u for u in day_users if u["username"] == "emp_test"), None)
        self.assertIsNotNone(employee_row)
        self.assertEqual(employee_row["name"], "emp_test")  # name falls back to username
        self.assertEqual(employee_row["user_id"], "EMP001")
        self.assertIn("email", employee_row)

    def test_assign_tokens_all_shifts(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post("/api/admin/tokens/assign/", {
            "shift": "all",
            "tokens": {"day": 50, "mid": 75, "night": 100},
        }, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.monthly_tokens, 50)  # Day shift amount
        self.guest.refresh_from_db()
        self.assertEqual(self.guest.monthly_tokens, 50)  # Guest in day shift


# ---------------------------------------------------------
# 3b. Bulk Import (users + menu) — CSV / JSON / XLSX
# ---------------------------------------------------------
class BulkImportTests(VDartCafeBaseTestCase):

    def _build_xlsx(self, headers, rows):
        from openpyxl import Workbook
        from io import BytesIO

        workbook = Workbook()
        sheet = workbook.active
        sheet.append(headers)
        for row in rows:
            sheet.append(row)
        buffer = BytesIO()
        workbook.save(buffer)
        buffer.seek(0)
        return buffer.read()

    def test_bulk_import_users_from_pasted_csv(self):
        self.client.force_authenticate(user=self.admin)
        csv_text = (
            "username,user_id,first_name,last_name,email,role,work_shift,monthly_tokens\n"
            "bulk_emp1,BK001,Ravi,Verma,ravi@vdartcafe.com,employee,mid,\n"
            "bulk_emp2,BK002,Sneha,Rao,sneha@vdartcafe.com,employee,night,40\n"
        )
        resp = self.client.post("/api/admin/users/bulk-import/", {"text": csv_text, "format": "csv"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["created"], 2)
        self.assertEqual(resp.data["errors"], [])

        emp1 = CustomUser.objects.get(username="bulk_emp1")
        self.assertEqual(emp1.monthly_tokens, 0)  # no implicit default
        self.assertEqual(emp1.work_shift, "mid")
        emp2 = CustomUser.objects.get(username="bulk_emp2")
        self.assertEqual(emp2.monthly_tokens, 40)
        # Password defaults to user id when not provided
        self.assertTrue(emp1.check_password("BK001"))

    def test_bulk_import_users_from_uploaded_csv_file(self):
        self.client.force_authenticate(user=self.admin)
        csv_bytes = (
            "username,user_id,email,role,work_shift\n"
            "file_emp1,FE001,file1@vdartcafe.com,employee,day\n"
        ).encode("utf-8")
        upload = SimpleUploadedFile("users.csv", csv_bytes, content_type="text/csv")
        resp = self.client.post("/api/admin/users/bulk-import/", {"file": upload}, format="multipart")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["created"], 1)
        self.assertTrue(CustomUser.objects.filter(username="file_emp1").exists())

    def test_bulk_import_users_from_xlsx_file(self):
        self.client.force_authenticate(user=self.admin)
        xlsx_bytes = self._build_xlsx(
            ["username", "user_id", "email", "role", "work_shift"],
            [["xlsx_emp1", "XL001", "xlsx1@vdartcafe.com", "employee", "day"]],
        )
        upload = SimpleUploadedFile(
            "users.xlsx", xlsx_bytes,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        resp = self.client.post("/api/admin/users/bulk-import/", {"file": upload}, format="multipart")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["created"], 1)
        self.assertTrue(CustomUser.objects.filter(username="xlsx_emp1").exists())

    def test_bulk_import_users_updates_existing_and_reports_bad_rows(self):
        self.client.force_authenticate(user=self.admin)
        csv_text = (
            "username,user_id,work_shift\n"
            "emp_test,EMP001,night\n"
            ",BAD001,day\n"
            "bad_shift_emp,BS001,evening\n"
        )
        resp = self.client.post("/api/admin/users/bulk-import/", {"text": csv_text, "format": "csv"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["updated"], 1)
        self.assertEqual(len(resp.data["errors"]), 2)
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.work_shift, "night")

    def test_bulk_import_menu_items_from_pasted_json(self):
        self.client.force_authenticate(user=self.staff)
        payload = {
            "text": '[{"name": "Masala Dosa", "price": 30, "description": "Crispy dosa"},'
                    ' {"name": "Bad Item", "description": "no price"}]',
            "format": "json",
        }
        resp = self.client.post("/api/staff/menu/bulk-import/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["created"], 1)
        self.assertEqual(len(resp.data["errors"]), 1)
        self.assertEqual(MenuItem.objects.get(name="Masala Dosa").price, 30)

    def test_bulk_import_menu_items_from_xlsx_file(self):
        self.client.force_authenticate(user=self.staff)
        xlsx_bytes = self._build_xlsx(
            ["name", "price", "description", "is_available"],
            [["Rava Kesari", 25, "Sweet kesari", "yes"]],
        )
        upload = SimpleUploadedFile(
            "menu.xlsx", xlsx_bytes,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        resp = self.client.post("/api/staff/menu/bulk-import/", {"file": upload}, format="multipart")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["created"], 1)
        item = MenuItem.objects.get(name="Rava Kesari")
        self.assertEqual(item.price, 25)
        self.assertTrue(item.is_available)

    def test_bulk_import_requires_admin_for_users(self):
        self.client.force_authenticate(user=self.employee)
        resp = self.client.post("/api/admin/users/bulk-import/", {"text": "username\nx1"})
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


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


# ---------------------------------------------------------
# 8. Digital Receipts & Extended Kitchen Workflows
# ---------------------------------------------------------
class DigitalReceiptTests(VDartCafeBaseTestCase):

    def setUp(self):
        super().setUp()
        self.order = Order.objects.create(
            user=self.employee,
            total_tokens=20,
            status="completed",
        )
        self.item1 = OrderItem.objects.create(
            order=self.order,
            menu_item=self.coffee,
            quantity=1,
            tokens_per_item=5,
        )
        self.item2 = OrderItem.objects.create(
            order=self.order,
            menu_item=self.sandwich,
            quantity=1,
            tokens_per_item=15,
        )

    def test_employee_can_fetch_own_order_receipt(self):
        self.client.force_authenticate(user=self.employee)
        resp = self.client.get(f"/api/orders/{self.order.id}/receipt/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["order_id"], self.order.id)
        self.assertIn("receipt_number", resp.data)
        self.assertTrue(resp.data["receipt_number"].startswith("VDART-RCPT-"))
        self.assertEqual(resp.data["total_tokens"], 20)
        self.assertEqual(len(resp.data["items"]), 2)
        self.assertEqual(resp.data["user"]["username"], "emp_test")
        self.assertEqual(resp.data["user"]["user_id"], "EMP001")
        self.assertIn("verification_code", resp.data)
        self.assertIn("cafe_info", resp.data)
        self.assertEqual(resp.data["cafe_info"]["name"], "VDart Cafe")

    def test_non_owner_forbidden_from_other_user_receipt(self):
        # Guest user attempts to access employee's receipt
        self.client.force_authenticate(user=self.guest)
        resp = self.client.get(f"/api/orders/{self.order.id}/receipt/")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_and_admin_can_view_any_order_receipt(self):
        # Staff inspection for kitchen printing
        self.client.force_authenticate(user=self.staff)
        resp_staff = self.client.get(f"/api/orders/{self.order.id}/receipt/")
        self.assertEqual(resp_staff.status_code, status.HTTP_200_OK)

        # Admin auditing
        self.client.force_authenticate(user=self.admin)
        resp_admin = self.client.get(f"/api/orders/{self.order.id}/receipt/")
        self.assertEqual(resp_admin.status_code, status.HTTP_200_OK)

    def test_receipt_nonexistent_order_returns_404(self):
        self.client.force_authenticate(user=self.employee)
        resp = self.client.get("/api/orders/999999/receipt/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


class KitchenLiveFeedAndWorkflowTests(VDartCafeBaseTestCase):

    def setUp(self):
        super().setUp()
        # Seed orders with different categories and statuses
        self.pending_order = Order.objects.create(
            user=self.employee, total_tokens=5, status="pending"
        )
        OrderItem.objects.create(
            order=self.pending_order, menu_item=self.coffee, quantity=1, tokens_per_item=5
        )

        self.approved_order = Order.objects.create(
            user=self.guest, total_tokens=15, status="approved"
        )
        OrderItem.objects.create(
            order=self.approved_order, menu_item=self.sandwich, quantity=1, tokens_per_item=15
        )

    def test_staff_live_feed_endpoint(self):
        self.client.force_authenticate(user=self.staff)
        resp = self.client.get("/api/staff/orders/live_feed/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("counts", resp.data)
        self.assertIn("latest_order_id", resp.data)
        self.assertIn("server_time", resp.data)
        self.assertGreaterEqual(resp.data["counts"]["pending"], 1)
        self.assertGreaterEqual(resp.data["counts"]["approved"], 1)

    def test_staff_orders_category_filtering(self):
        self.client.force_authenticate(user=self.staff)

        # Coffee was auto-categorized as beverage in MenuItem.save()
        resp_bev = self.client.get("/api/staff/orders/?category=beverage")
        self.assertEqual(resp_bev.status_code, status.HTTP_200_OK)
        order_ids = [o["id"] for o in resp_bev.data]
        self.assertIn(self.pending_order.id, order_ids)

    def test_staff_orders_status_filtering(self):
        self.client.force_authenticate(user=self.staff)

        resp_pending = self.client.get("/api/staff/orders/?status=pending")
        self.assertEqual(resp_pending.status_code, status.HTTP_200_OK)
        for o in resp_pending.data:
            self.assertEqual(o["status"], "pending")

        resp_approved = self.client.get("/api/staff/orders/?status=approved")
        self.assertEqual(resp_approved.status_code, status.HTTP_200_OK)
        for o in resp_approved.data:
            self.assertEqual(o["status"], "approved")

    def test_employee_orders_includes_server_time_and_token_balance(self):
        self.client.force_authenticate(user=self.employee)
        resp = self.client.get("/api/employee/orders/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("today_orders", resp.data)
        self.assertIn("past_orders", resp.data)
        self.assertIn("server_time", resp.data)
        self.assertIn("tokens_balance", resp.data)
        self.assertEqual(resp.data["tokens_balance"], 50)

