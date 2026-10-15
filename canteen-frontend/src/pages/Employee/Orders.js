import MyOrdersExperience from '../../components/canteen/MyOrdersExperience';
import { employeeAPI } from '../../utils/api';

const EmployeeOrders = () => <MyOrdersExperience api={employeeAPI} />;
export default EmployeeOrders;
