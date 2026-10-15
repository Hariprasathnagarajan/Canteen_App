import MyOrdersExperience from '../../components/canteen/MyOrdersExperience';
import { guestAPI } from '../../utils/api';

const GuestOrders = () => <MyOrdersExperience api={guestAPI} />;
export default GuestOrders;
