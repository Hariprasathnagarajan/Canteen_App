import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ProfileModalContext = createContext({ open: false, openProfile: () => {}, closeProfile: () => {} });

export const useProfileModal = () => useContext(ProfileModalContext);

export const ProfileModalProvider = ({ children }) => {
  const [open, setOpen] = useState(false);
  const openProfile = useCallback(() => setOpen(true), []);
  const closeProfile = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ open, openProfile, closeProfile }), [open, openProfile, closeProfile]);

  return <ProfileModalContext.Provider value={value}>{children}</ProfileModalContext.Provider>;
};

export default ProfileModalContext;
