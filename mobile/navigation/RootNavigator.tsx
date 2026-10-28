import React from 'react';
import { View, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { useAuth } from '../store/AuthContext';

// Drawer Sidebar Content
import { CustomDrawerContent } from '../components/layout/CustomDrawerContent';

// Screens
import { LoginScreen } from '../screens/auth/LoginScreen';
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen';
import { CustomerListScreen } from '../screens/admin/CustomerListScreen';
import { AddCustomerScreen } from '../screens/admin/AddCustomerScreen';
import { CustomerDetailScreen } from '../screens/admin/CustomerDetailScreen';
import { CustomerScheduleScreen } from '../screens/admin/CustomerScheduleScreen';
import { ChitGroupListScreen } from '../screens/admin/ChitGroupListScreen';
import { ChitGroupDetailScreen } from '../screens/admin/ChitGroupDetailScreen';
import { ReceiptEntryScreen } from '../screens/admin/ReceiptEntryScreen';
import { ReportsScreen } from '../screens/admin/ReportsScreen';
import { ManageBanksScreen } from '../screens/admin/ManageBanksScreen';
import { LedgerScreen } from '../screens/admin/LedgerScreen';
import { PaymentVerificationsScreen } from '../screens/admin/PaymentVerificationsScreen';
import { NotificationsScreen } from '../screens/admin/NotificationsScreen';
import { SettingsScreen } from '../screens/admin/SettingsScreen';
import { StaffDashboardScreen } from '../screens/staff/StaffDashboardScreen';
import { CustomerDashboardScreen } from '../screens/customer/CustomerDashboardScreen';
import { CustomerBankDetailsScreen } from '../screens/customer/CustomerBankDetailsScreen';
import { CustomerPaymentHistoryScreen } from '../screens/customer/CustomerPaymentHistoryScreen';
import { CustomerSupportScreen } from '../screens/customer/CustomerSupportScreen';
import { CustomerPortfolioScreen } from '../screens/customer/CustomerPortfolioScreen';

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

// Admin Sidebar Drawer containing all management modules from Web Application
const AdminDrawer = () => {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={({ navigation }) => ({
        headerShown: true,
        headerStyle: { backgroundColor: '#F9FBFB', elevation: 0, shadowOpacity: 0 },
        headerTintColor: '#0C8A7D',
        headerTitleStyle: { fontWeight: '800', fontSize: 18, color: '#086359' },
        drawerType: 'front',
        headerLeft: () => (
          <TouchableOpacity
            style={{ paddingLeft: 16, paddingRight: 8 }}
            onPress={() => navigation.openDrawer()}
          >
            <Ionicons name="menu" size={26} color="#0C8A7D" />
          </TouchableOpacity>
        ),
        headerRight: () => (
          <TouchableOpacity
            style={{ paddingRight: 16, paddingLeft: 8 }}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Ionicons name="notifications-outline" size={22} color="#0C8A7D" />
          </TouchableOpacity>
        ),
      })}
    >
      <Drawer.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{ title: 'Jenista Chit Funds', headerRight: () => null }}
      />
      <Drawer.Screen
        name="CustomerList"
        component={CustomerListScreen}
        options={{ title: 'Customer Directory' }}
      />
      <Drawer.Screen
        name="AddCustomer"
        component={AddCustomerScreen}
        options={{ title: 'Register Customer' }}
      />
      <Drawer.Screen
        name="ChitGroupList"
        component={ChitGroupListScreen}
        options={{ title: 'Chit Groups & Plans' }}
      />
      <Drawer.Screen
        name="Ledger"
        component={LedgerScreen}
        options={{ title: 'General Ledger' }}
      />
      <Drawer.Screen
        name="PaymentVerifications"
        component={PaymentVerificationsScreen}
        options={{ title: 'Payment Verifications' }}
      />
      <Drawer.Screen
        name="ManageBanks"
        component={ManageBanksScreen}
        options={{ title: 'Company Bank Accounts' }}
      />
      <Drawer.Screen
        name="Reports"
        component={ReportsScreen}
        options={{ title: 'Non-Payers & Defaulters' }}
      />
      <Drawer.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications & Alerts' }}
      />
      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'System & Policy Settings' }}
      />
    </Drawer.Navigator>
  );
};

// Staff Sidebar Drawer
const StaffDrawer = () => {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={({ navigation }) => ({
        headerShown: true,
        headerStyle: { backgroundColor: '#F9FBFB', elevation: 0, shadowOpacity: 0 },
        headerTintColor: '#0C8A7D',
        headerTitleStyle: { fontWeight: '800', fontSize: 18, color: '#086359' },
        drawerType: 'front',
        headerLeft: () => (
          <TouchableOpacity
            style={{ paddingLeft: 16, paddingRight: 8 }}
            onPress={() => navigation.openDrawer()}
          >
            <Ionicons name="menu" size={26} color="#0C8A7D" />
          </TouchableOpacity>
        ),
        headerRight: () => (
          <TouchableOpacity
            style={{ paddingRight: 16, paddingLeft: 8 }}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Ionicons name="notifications-outline" size={22} color="#0C8A7D" />
          </TouchableOpacity>
        ),
      })}
    >
      <Drawer.Screen
        name="StaffDashboard"
        component={StaffDashboardScreen}
        options={{ title: 'Staff Dashboard' }}
      />
      <Drawer.Screen
        name="ReceiptEntry"
        component={ReceiptEntryScreen}
        options={{ title: 'Raise Receipts' }}
      />
      <Drawer.Screen
        name="CustomerList"
        component={CustomerListScreen}
        options={{ title: 'Customers Directory' }}
      />
      <Drawer.Screen
        name="AddCustomer"
        component={AddCustomerScreen}
        options={{ title: 'Add Customer' }}
      />
      <Drawer.Screen
        name="ChitGroupList"
        component={ChitGroupListScreen}
        options={{ title: 'Chit Groups & Enroll' }}
      />
      <Drawer.Screen
        name="Reports"
        component={ReportsScreen}
        options={{ title: 'Overdue Dues Report' }}
      />
    </Drawer.Navigator>
  );
};

const Tab = createBottomTabNavigator();

// Customer Bottom Tab Navigator matching Funds Genie design
const CustomerTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#F9FBFB', elevation: 0, shadowOpacity: 0 },
        headerTintColor: '#0C8A7D',
        headerTitleStyle: { fontWeight: '800', fontSize: 18, color: '#086359' },
        tabBarActiveTintColor: '#0C8A7D',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
        },
        headerRight: () => null,
      }}
    >
      <Tab.Screen
        name="CustomerHome"
        component={CustomerDashboardScreen}
        options={{
          headerShown: false,
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="CustomerBankDetails"
        component={CustomerBankDetailsScreen}
        options={{
          title: 'Official Bank & UPI',
          tabBarLabel: 'Bank & UPI',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'wallet' : 'wallet-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="CustomerPaymentHistory"
        component={CustomerPaymentHistoryScreen}
        options={{
          title: 'Payment Receipts',
          tabBarLabel: 'Receipts',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="CustomerSupport"
        component={CustomerSupportScreen}
        options={{
          title: 'Help & Support',
          tabBarLabel: 'Support',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'headset' : 'headset-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export const RootNavigator = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary[600]} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated || !user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : user.role === 'CUSTOMER' ? (
          <>
            <Stack.Screen name="CustomerRoot" component={CustomerTabs} />
            <Stack.Screen
              name="CustomerPortfolio"
              component={CustomerPortfolioScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CustomerSchedule"
              component={CustomerScheduleScreen}
              options={{
                headerShown: true,
                title: 'Due Schedule & Statement',
                headerStyle: { backgroundColor: '#F9FBFB' },
                headerTintColor: '#0C8A7D',
                headerTitleStyle: { fontWeight: '800', color: '#086359' },
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{
                headerShown: true,
                title: 'Notifications & Alerts',
                headerStyle: { backgroundColor: '#F9FBFB' },
                headerTintColor: '#0C8A7D',
                headerTitleStyle: { fontWeight: '800', color: '#086359' },
                headerShadowVisible: false,
              }}
            />
          </>
        ) : user.role === 'STAFF' || user.role === 'COLLECTION_AGENT' ? (
          <>
            <Stack.Screen name="StaffRoot" component={StaffDrawer} />
            <Stack.Screen
              name="ChitGroupDetail"
              component={ChitGroupDetailScreen}
              options={{
                headerShown: true,
                title: 'Group & Enrolled Members',
                headerStyle: { backgroundColor: '#F9FBFB' },
                headerTintColor: '#0C8A7D',
                headerTitleStyle: { fontWeight: '800', color: '#086359' },
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen
              name="CustomerDetail"
              component={CustomerDetailScreen}
              options={{
                headerShown: true,
                title: 'Member Profile',
                headerStyle: { backgroundColor: '#F9FBFB' },
                headerTintColor: '#0C8A7D',
                headerTitleStyle: { fontWeight: '800', color: '#086359' },
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen
              name="CustomerSchedule"
              component={CustomerScheduleScreen}
              options={{
                headerShown: true,
                title: 'Installment Breakdown',
                headerStyle: { backgroundColor: '#F9FBFB' },
                headerTintColor: '#0C8A7D',
                headerTitleStyle: { fontWeight: '800', color: '#086359' },
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen
              name="ReceiptEntry"
              component={ReceiptEntryScreen}
              options={{
                headerShown: true,
                title: 'Receipt Desk & Collections',
                headerStyle: { backgroundColor: '#F9FBFB' },
                headerTintColor: '#0C8A7D',
                headerTitleStyle: { fontWeight: '800', color: '#086359' },
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{
                headerShown: true,
                title: 'Notifications & Alerts',
                headerStyle: { backgroundColor: '#F9FBFB' },
                headerTintColor: '#0C8A7D',
                headerTitleStyle: { fontWeight: '800', color: '#086359' },
                headerShadowVisible: false,
              }}
            />
          </>
        ) : (
          // Admin Flow with Full Sidebar
          <>
            <Stack.Screen name="AdminRoot" component={AdminDrawer} />
            <Stack.Screen
              name="ChitGroupDetail"
              component={ChitGroupDetailScreen}
              options={{
                headerShown: true,
                title: 'Group & Enrolled Members',
                headerStyle: { backgroundColor: '#F9FBFB' },
                headerTintColor: '#0C8A7D',
                headerTitleStyle: { fontWeight: '800', color: '#086359' },
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen
              name="CustomerDetail"
              component={CustomerDetailScreen}
              options={{
                headerShown: true,
                title: 'Member Profile',
                headerStyle: { backgroundColor: '#F9FBFB' },
                headerTintColor: '#0C8A7D',
                headerTitleStyle: { fontWeight: '800', color: '#086359' },
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen
              name="CustomerSchedule"
              component={CustomerScheduleScreen}
              options={{
                headerShown: true,
                title: 'Installment Breakdown',
                headerStyle: { backgroundColor: '#F9FBFB' },
                headerTintColor: '#0C8A7D',
                headerTitleStyle: { fontWeight: '800', color: '#086359' },
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen
              name="ReceiptEntry"
              component={ReceiptEntryScreen}
              options={{
                headerShown: true,
                title: 'Receipt Desk & Collections',
                headerStyle: { backgroundColor: '#F9FBFB' },
                headerTintColor: '#0C8A7D',
                headerTitleStyle: { fontWeight: '800', color: '#086359' },
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{
                headerShown: true,
                title: 'Notifications & Alerts',
                headerStyle: { backgroundColor: '#F9FBFB' },
                headerTintColor: '#0C8A7D',
                headerTitleStyle: { fontWeight: '800', color: '#086359' },
                headerShadowVisible: false,
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#F9FBFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
