import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useAuth } from '../../store/AuthContext';

export const CustomDrawerContent: React.FC<DrawerContentComponentProps> = (props) => {
  const { user, logout } = useAuth();
  const currentRoute = props.state.routeNames[props.state.index];

  const navigateTo = (screenName: string, params?: any) => {
    props.navigation.closeDrawer();
    if (params) {
      props.navigation.navigate(screenName, { ...params, _t: Date.now() });
    } else {
      props.navigation.navigate(screenName);
    }
  };

  const isStaff = user?.role === 'STAFF' || user?.role === 'COLLECTION_AGENT';
  const isCustomer = user?.role === 'CUSTOMER';

  const displayName = user?.name || (isCustomer ? 'Member' : 'Administrator');
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'U';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Brand & User Profile Header (Reference Screen 7 & 9) */}
      <View style={styles.header}>
        {/* User Profile Card */}
        <View style={styles.userProfileRow}>
          <View style={styles.avatarBubble}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.userName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.userRoleText}>
              {user?.role === 'CUSTOMER' ? 'Member' : 'Administrator'}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={18} color="rgba(255, 255, 255, 0.5)" />
        </View>
      </View>

        {/* Navigation List Items */}
      <ScrollView style={styles.menuContainer} showsVerticalScrollIndicator={false}>
        <DrawerItem
          title="Home"
          icon="home-outline"
          isActive={currentRoute === 'AdminDashboard' || currentRoute === 'StaffDashboard' || currentRoute === 'CustomerHome'}
          onPress={() => navigateTo(isCustomer ? 'CustomerHome' : isStaff ? 'StaffDashboard' : 'AdminDashboard', isCustomer ? { action: 'HOME' } : undefined)}
        />

        {isCustomer ? (
          <>
            <DrawerItem
              title="My Chit Portfolio"
              icon="layers-outline"
              isActive={currentRoute === 'CustomerHome'}
              onPress={() => navigateTo('CustomerHome', { action: 'PORTFOLIO' })}
            />
            <DrawerItem
              title="Official Bank & UPI"
              icon="business-outline"
              isActive={false}
              onPress={() => navigateTo('CustomerHome', { action: 'BANK_DETAILS' })}
            />
            <DrawerItem
              title="Payment History"
              icon="receipt-outline"
              isActive={false}
              onPress={() => navigateTo('CustomerHome', { action: 'STATEMENTS' })}
            />
            <View style={styles.menuDivider} />
            <DrawerItem
              title="Settings & Policies"
              icon="settings-outline"
              isActive={currentRoute === 'CustomerSettings'}
              onPress={() => navigateTo('CustomerSettings')}
            />
            <DrawerItem
              title="Help & Support"
              icon="headset-outline"
              isActive={false}
              onPress={() => navigateTo('CustomerHome', { action: 'SUPPORT' })}
            />
          </>
        ) : (
          <>
            <DrawerItem
              title="Members"
              icon="people-outline"
              isActive={currentRoute === 'CustomerList'}
              onPress={() => navigateTo('CustomerList')}
            />

            <DrawerItem
              title="Groups"
              icon="layers-outline"
              isActive={currentRoute === 'ChitGroupList'}
              onPress={() => navigateTo('ChitGroupList')}
            />

            <DrawerItem
              title="Payments"
              icon="card-outline"
              isActive={currentRoute === 'Ledger'}
              onPress={() => navigateTo('Ledger')}
            />

            <View style={styles.menuDivider} />

            <DrawerItem
              title="Add New Member"
              icon="person-add-outline"
              isActive={currentRoute === 'AddCustomer'}
              onPress={() => navigateTo('AddCustomer')}
            />

            <DrawerItem
              title="Company Banks"
              icon="business-outline"
              isActive={currentRoute === 'ManageBanks'}
              onPress={() => navigateTo('ManageBanks')}
            />

            <DrawerItem
              title="Non-Payers Report"
              icon="bar-chart-outline"
              isActive={currentRoute === 'Reports'}
              onPress={() => navigateTo('Reports')}
            />

            <DrawerItem
              title="Payment Verifications"
              icon="shield-checkmark-outline"
              isActive={currentRoute === 'PaymentVerifications'}
              onPress={() => navigateTo('PaymentVerifications')}
            />

            <DrawerItem
              title="Notifications"
              icon="notifications-outline"
              isActive={currentRoute === 'Notifications'}
              onPress={() => navigateTo('Notifications')}
            />

            <View style={styles.menuDivider} />

            <DrawerItem
              title="Settings"
              icon="settings-outline"
              isActive={currentRoute === 'Settings'}
              onPress={() => navigateTo('Settings')}
            />

            <DrawerItem
              title="Help & Support"
              icon="help-circle-outline"
              isActive={false}
              onPress={() => navigateTo('Settings')}
            />
          </>
        )}
      </ScrollView>

      {/* Footer Sign Out */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={Colors.gold.primary} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
        <Text style={styles.versionText}>Jenista Chit Funds • v1.0.8</Text>
      </View>
    </SafeAreaView>
  );
};

const DrawerItem: React.FC<{
  title: string;
  icon: any;
  isActive: boolean;
  onPress: () => void;
}> = ({ title, icon, isActive, onPress }) => (
  <TouchableOpacity
    style={[styles.item, isActive && styles.itemActive]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Ionicons
      name={icon}
      size={20}
      color={isActive ? Colors.gold.primary : 'rgba(255, 255, 255, 0.7)'}
    />
    <Text style={[styles.itemText, isActive && styles.itemTextActive]}>{title}</Text>
    {isActive && <View style={styles.activeDot} />}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.navy.primary,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  userProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  avatarBubble: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.gold.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0B1A30',
  },
  userName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.2,
  },
  userRoleText: {
    fontSize: 11,
    color: Colors.gold.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  menuContainer: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 10,
    marginHorizontal: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    gap: 12,
    marginVertical: 2,
  },
  itemActive: {
    backgroundColor: 'rgba(255, 191, 50, 0.12)',
  },
  itemText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  itemTextActive: {
    color: Colors.gold.primary,
    fontWeight: '800',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.gold.primary,
  },
  footer: {
    padding: 18,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gold.primary,
  },
  versionText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 8,
  },
});
