import os
import django
from datetime import date

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'canteen_backend.settings')
django.setup()

from django.utils import timezone
from api.models import CustomUser, MenuItem, Order, OrderItem, ShiftTokenAllocation, TokenDistribution

def seed():
    print("--- Starting Canteen App Data Seeding ---")

    # 1. Create or Update Users
    users_data = [
        # Admins
        {
            'username': 'admin',
            'first_name': 'System',
            'last_name': 'Admin',
            'email': 'admin@canteen.local',
            'role': 'admin',
            'work_shift': 'day',
            'user_id': 'ADM001',
            'is_staff': True,
            'is_superuser': True,
            'password': 'AdminPassword123!',
            'tokens': 0,
        },
        {
            'username': 'hari',
            'first_name': 'Hari',
            'last_name': 'Prasath',
            'email': 'hari@canteen.local',
            'role': 'admin',
            'work_shift': 'day',
            'user_id': 'ADM002',
            'is_staff': True,
            'is_superuser': True,
            'password': 'AdminPassword123!',
            'tokens': 0,
        },
        # Staff
        {
            'username': 'staff',
            'first_name': 'Kitchen',
            'last_name': 'Staff',
            'email': 'staff@canteen.local',
            'role': 'staff',
            'work_shift': 'day',
            'user_id': 'STF001',
            'is_staff': True,
            'password': 'StaffPassword123!',
            'tokens': 0,
        },
        {
            'username': 'sago',
            'first_name': 'Sago',
            'last_name': 'Chef',
            'email': 'sago@canteen.local',
            'role': 'staff',
            'work_shift': 'day',
            'user_id': 'STF002',
            'is_staff': True,
            'password': 'StaffPassword123!',
            'tokens': 0,
        },
        # Employees
        {
            'username': 'employee_day',
            'first_name': 'Rajesh',
            'last_name': 'Kumar',
            'email': 'rajesh.day@canteen.local',
            'role': 'employee',
            'work_shift': 'day',
            'user_id': 'EMP001',
            'password': 'EmployeePassword123!',
            'tokens': 50,
        },
        {
            'username': 'employee_mid',
            'first_name': 'Priya',
            'last_name': 'Raman',
            'email': 'priya.mid@canteen.local',
            'role': 'employee',
            'work_shift': 'mid',
            'user_id': 'EMP002',
            'password': 'EmployeePassword123!',
            'tokens': 75,
        },
        {
            'username': 'employee_night',
            'first_name': 'Vikram',
            'last_name': 'Singh',
            'email': 'vikram.night@canteen.local',
            'role': 'employee',
            'work_shift': 'night',
            'user_id': 'EMP003',
            'password': 'EmployeePassword123!',
            'tokens': 100,
        },
        {
            'username': 'faizel',
            'first_name': 'Faizel',
            'last_name': 'Ahmed',
            'email': 'faizel@canteen.local',
            'role': 'employee',
            'work_shift': 'day',
            'user_id': 'EMP004',
            'password': 'EmployeePassword123!',
            'tokens': 50,
        },
        {
            'username': 'marish',
            'first_name': 'Marish',
            'last_name': 'Kannan',
            'email': 'marish@canteen.local',
            'role': 'employee',
            'work_shift': 'mid',
            'user_id': 'EMP005',
            'password': 'EmployeePassword123!',
            'tokens': 75,
        },
        # Guests
        {
            'username': 'guest',
            'first_name': 'Ananya',
            'last_name': 'Sharma',
            'email': 'guest@canteen.local',
            'role': 'guest',
            'work_shift': 'day',
            'user_id': 'GST001',
            'password': 'GuestPassword123!',
            'tokens': 30,
        },
        {
            'username': 'kumar',
            'first_name': 'Kumar',
            'last_name': 'Vel',
            'email': 'kumar@canteen.local',
            'role': 'guest',
            'work_shift': 'day',
            'user_id': 'GST002',
            'password': 'GuestPassword123!',
            'tokens': 30,
        },
    ]

    created_users = {}
    for u in users_data:
        user, created = CustomUser.objects.get_or_create(username=u['username'])
        user.first_name = u['first_name']
        user.last_name = u['last_name']
        user.email = u['email']
        user.role = u['role']
        user.work_shift = u['work_shift']
        user.user_id = u['user_id']
        user.is_staff = u.get('is_staff', False)
        user.is_superuser = u.get('is_superuser', False)
        user.monthly_tokens = u.get('tokens', 0)
        user.last_token_reset = timezone.now().date()
        user.set_password(u['password'])
        user.save()
        created_users[u['username']] = user
        action = "Created" if created else "Updated"
        print(f"[{action}] User: {user.username} (Role: {user.role}, Tokens: {user.monthly_tokens})")

    # 2. Seed Shift Allocations for current month
    current_month_start = timezone.now().date().replace(day=1)
    shifts = [
        ('day', 50),
        ('mid', 75),
        ('night', 100),
    ]
    for shift_name, token_amt in shifts:
        alloc, _ = ShiftTokenAllocation.objects.get_or_create(
            shift=shift_name,
            allocation_month=current_month_start,
            defaults={'tokens_per_user': token_amt}
        )
        alloc.tokens_per_user = token_amt
        alloc.save()
        print(f"[Shift Allocation] {shift_name.capitalize()} shift -> {token_amt} tokens/user")

    # 3. Seed Menu Items
    menu_data = [
        {
            'name': 'Masala Dosa with Sambar & Chutneys',
            'description': 'Crispy golden rice-lentil crepe filled with aromatic spiced potato masala, served with steaming lentil sambar and fresh coconut chutney.',
            'price': 2,
            'is_available': True,
        },
        {
            'name': 'Idli Vada Combo',
            'description': 'Two soft steamed rice cakes paired with a golden-fried crunchy medu vada, served with traditional sambar and spicy tomato chutney.',
            'price': 2,
            'is_available': True,
        },
        {
            'name': 'South Indian Executive Thali',
            'description': 'Complete balanced meal with fragrant steamed rice, sambar, rasam, kootu, vegetable poriyal, curd, appalam, and sweet payasam.',
            'price': 5,
            'is_available': True,
        },
        {
            'name': 'Paneer Butter Masala with 3 Rotis',
            'description': 'Fresh cottage cheese cubes simmered in a creamy, velvety butter-tomato gravy, served with 3 fluffy whole-wheat rotis.',
            'price': 4,
            'is_available': True,
        },
        {
            'name': 'Hyderabadi Chicken Dum Biryani',
            'description': 'Aromatic long-grain basmati rice cooked on dum with marinated chicken cuts, saffron, mint, and whole spices, served with cooling raita.',
            'price': 6,
            'is_available': True,
        },
        {
            'name': 'Veg Fried Rice & Manchurian Bowl',
            'description': 'Wok-tossed vegetables and rice paired with crispy vegetable dumplings in savory Indo-Chinese garlic Manchurian sauce.',
            'price': 4,
            'is_available': True,
        },
        {
            'name': 'Crispy Onion Samosas (3 pcs)',
            'description': 'Flaky golden pastry triangles filled with seasoned onions and mild spices, served with tangy tamarind and mint chutneys.',
            'price': 1,
            'is_available': True,
        },
        {
            'name': 'South Indian Filter Coffee',
            'description': 'Authentic chicory-infused decoction brewed with frothy boiling milk, served hot in traditional brass tumbler style.',
            'price': 1,
            'is_available': True,
        },
        {
            'name': 'Fresh Alphonso Mango Lassi',
            'description': 'Creamy churned yogurt blended with sweet mango pulp, cardamom, and garnished with roasted pistachios.',
            'price': 1,
            'is_available': True,
        },
        {
            'name': 'Grilled Chicken Club Sandwich',
            'description': 'Triple-decker toasted bread filled with shredded roasted chicken, cheese slice, lettuce, tomato, and seasoned French fries.',
            'price': 3,
            'is_available': True,
        },
        {
            'name': 'Seasonal Fresh Fruit Bowl',
            'description': 'A refreshing mix of fresh papaya, pomegranate, watermelon, and apple drizzled with organic honey and fresh mint leaves.',
            'price': 2,
            'is_available': True,
        },
        {
            'name': 'Egg Hakka Noodles',
            'description': 'Stir-fried noodles tossed with scrambled eggs, shredded cabbage, bell peppers, carrots, and light soy seasoning.',
            'price': 3,
            'is_available': True,
        },
    ]

    menu_objects = []
    for m in menu_data:
        item, created = MenuItem.objects.get_or_create(
            name=m['name'],
            defaults={
                'description': m['description'],
                'price': m['price'],
                'is_available': m['is_available']
            }
        )
        if not created:
            item.description = m['description']
            item.price = m['price']
            item.is_available = m['is_available']
            item.save()
        menu_objects.append(item)
        print(f"[Menu Item] {item.name} ({item.price} tokens)")

    # 4. Seed Sample Orders across statuses
    emp_day = created_users.get('employee_day')
    emp_mid = created_users.get('employee_mid')
    emp_night = created_users.get('employee_night')
    guest_user = created_users.get('guest')

    sample_orders = [
        # Pending orders for Staff review
        {
            'user': emp_day,
            'status': 'pending',
            'items': [
                (menu_objects[0], 2), # 2 x Masala Dosa (4 tokens)
                (menu_objects[7], 2), # 2 x Filter Coffee (2 tokens)
            ]
        },
        {
            'user': guest_user,
            'status': 'pending',
            'items': [
                (menu_objects[9], 1), # 1 x Sandwich (3 tokens)
                (menu_objects[8], 1), # 1 x Mango Lassi (1 token)
            ]
        },
        # Approved order for Kitchen preparation
        {
            'user': emp_mid,
            'status': 'approved',
            'items': [
                (menu_objects[3], 1), # 1 x Paneer Butter Masala (4 tokens)
                (menu_objects[6], 1), # 1 x Samosas (1 token)
            ]
        },
        # Completed historical order
        {
            'user': emp_night,
            'status': 'completed',
            'items': [
                (menu_objects[4], 1), # 1 x Chicken Biryani (6 tokens)
                (menu_objects[8], 1), # 1 x Mango Lassi (1 token)
            ]
        },
    ]

    for order_info in sample_orders:
        if not order_info['user']:
            continue
        order = Order.objects.create(
            user=order_info['user'],
            status=order_info['status'],
            total_tokens=sum(m.price * qty for m, qty in order_info['items'])
        )
        for m, qty in order_info['items']:
            OrderItem.objects.create(
                order=order,
                menu_item=m,
                quantity=qty,
                tokens_per_item=m.price
            )
        print(f"[Order] Created Order #{order.id} for {order.user.username} - Status: {order.status} ({order.total_tokens} tokens)")

    print("--- Seeding Completed Successfully! ---")

if __name__ == '__main__':
    seed()
