import MenuExperience from '../../components/canteen/MenuExperience';
import { guestAPI } from '../../utils/api';

const GuestMenu = () => (
  <MenuExperience api={guestAPI} serviceNote="Guest lunch · 12:00 – 14:30" />
);

export default GuestMenu;
