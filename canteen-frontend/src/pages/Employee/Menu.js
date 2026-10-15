import MenuExperience from '../../components/canteen/MenuExperience';
import { employeeAPI } from '../../utils/api';

const EmployeeMenu = () => (
  <MenuExperience api={employeeAPI} serviceNote="Employee lunch · 12:00 – 14:30" />
);

export default EmployeeMenu;
