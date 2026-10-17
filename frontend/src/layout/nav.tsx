import {
  CloudServerOutlined,
  CrownOutlined,
  DashboardOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { ROLE_ADMIN, ROLE_SUPER_ADMIN } from '@/auth/roles'
import type { NavItem } from './navMatch'

/** Left menu. An item is shown to the listed roles; a super admin sees all of them. The dashboard is the list of backup plans. */
export const MAIN_NAV: NavItem[] = [
  {
    key: 'dashboard',
    labelKey: 'navigation.dashboard',
    icon: <DashboardOutlined />,
    testId: 'nav-dashboard',
    roles: 'all',
    path: '/',
  },
  {
    key: 'storages',
    labelKey: 'navigation.storages',
    icon: <CloudServerOutlined />,
    testId: 'nav-storages',
    roles: [ROLE_ADMIN],
    path: '/storages',
  },
  {
    key: 'users',
    labelKey: 'navigation.users',
    icon: <TeamOutlined />,
    testId: 'nav-users',
    roles: [ROLE_ADMIN],
    path: '/users',
  },
]

/** Right menu, rendered only for super admins. */
export const ADMIN_NAV: NavItem[] = [
  {
    key: 'super-admins',
    labelKey: 'navigation.superAdmins',
    icon: <CrownOutlined />,
    testId: 'admin-menu-super-admins',
    roles: [ROLE_SUPER_ADMIN],
    path: '/admin/super-admins',
  },
  {
    key: 'admins',
    labelKey: 'navigation.admins',
    icon: <SafetyCertificateOutlined />,
    testId: 'admin-menu-admins',
    roles: [ROLE_SUPER_ADMIN],
    path: '/admin/admins',
  },
]
