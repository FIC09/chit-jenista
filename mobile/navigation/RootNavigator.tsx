import React from 'react';
import { View, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
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

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

// Admin Sidebar Drawer containing all management modules from Web Application
const AdminDrawer = () => {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={({ navigation }) => ({
        headerShown: true,
        headerStyle: { backgroundColor: Colors.navy.primary },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: '800', fontSize: 17 },
        drawerType: 'front',
        headerLeft: () => (
          <TouchableOpacity
            style={{ paddingLeft: 16, paddingRight: 8 }}
            onPress={() => navigation.openDrawer()}
          >
            <Ionicons name="menu" size={26} color={Colors.white} />
          </TouchableOpacity>
        ),
      })}
    >
      <Drawer.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{ title: 'Jenista Chit Funds' }}
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
        headerStyle: { backgroundColor: Colors.navy.primary },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: '800', fontSize: 17 },
        drawerType: 'front',
        headerLeft: () => (
          <TouchableOpacity
            style={{ paddingLeft: 16, paddingRight: 8 }}
            onPress={() => navigation.openDrawer()}
          >
            <Ionicons name="menu" size={26} color={Colors.white} />
          </TouchableOpacity>
        ),
      })}
    >
      <Drawer.Screen
        name="StaffDashboard"
        component={StaffDashboardScreen}
        options={{ title: 'Field Collections' }}
      />
      <Drawer.Screen
        name="CustomerList"
        component={CustomerListScreen}
        options={{ title: 'Members Directory' }}
      />
      <Drawer.Screen
        name="AddCustomer"
        component={AddCustomerScreen}
        options={{ title: 'Register Member' }}
      />
      <Drawer.Screen
        name="Reports"
        component={ReportsScreen}
        options={{ title: 'Overdue Dues Report' }}
      />
    </Drawer.Navigator>
  );
};

// Customer Sidebar Drawer containing CustomDrawerContent
const CustomerDrawer = () => {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={({ navigation }) => ({
        headerShown: true,
        headerStyle: { backgroundColor: Colors.navy.primary },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: '800', fontSize: 17 },
        drawerType: 'front',
        headerLeft: () => (
          <TouchableOpacity
            style={{ paddingLeft: 16, paddingRight: 8 }}
            onPress={() => navigation.openDrawer()}
          >
            <Ionicons name="menu" size={26} color={Colors.white} />
          </TouchableOpacity>
        ),
      })}
    >
      <Drawer.Screen
        name="CustomerHome"
        component={CustomerDashboardScreen}
        options={{ title: 'Jenista Chit Funds' }}
      />
      <Drawer.Screen
        name="CustomerSettings"
        component={SettingsScreen}
        options={{ title: 'Settings & Profile' }}
      />
    </Drawer.Navigator>
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
            <Stack.Screen name="CustomerRoot" component={CustomerDrawer} />
            <Stack.Screen
              name="CustomerSchedule"
              component={CustomerScheduleScreen}
              options={{ headerShown: true, title: 'Installment Breakdown', headerStyle: { backgroundColor: Colors.navy.primary }, headerTintColor: Colors.white }}
            />
          </>
        ) : user.role === 'STAFF' || user.role === 'COLLECTION_AGENT' ? (
          <>
            <Stack.Screen name="StaffRoot" component={StaffDrawer} />
            <Stack.Screen
              name="ChitGroupDetail"
              component={ChitGroupDetailScreen}
              options={{ headerShown: true, title: 'Group & Enrolled Members', headerStyle: { backgroundColor: Colors.navy.primary }, headerTintColor: Colors.white }}
            />
            <Stack.Screen
              name="CustomerDetail"
              component={CustomerDetailScreen}
              options={{ headerShown: true, title: 'Member Profile', headerStyle: { backgroundColor: Colors.navy.primary }, headerTintColor: Colors.white }}
            />
            <Stack.Screen
              name="CustomerSchedule"
              component={CustomerScheduleScreen}
              options={{ headerShown: true, title: 'Installment Breakdown', headerStyle: { backgroundColor: Colors.navy.primary }, headerTintColor: Colors.white }}
            />
            <Stack.Screen
              name="ReceiptEntry"
              component={ReceiptEntryScreen}
              options={{ headerShown: true, title: 'Receipt Desk & Collections', headerStyle: { backgroundColor: Colors.navy.primary }, headerTintColor: Colors.white }}
            />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{ headerShown: true, title: 'Notifications & Alerts', headerStyle: { backgroundColor: Colors.navy.primary }, headerTintColor: Colors.white }}
            />
          </>
        ) : (
          // Admin Flow with Full Sidebar
          <>
            <Stack.Screen name="AdminRoot" component={AdminDrawer} />
            <Stack.Screen
              name="ChitGroupDetail"
              component={ChitGroupDetailScreen}
              options={{ headerShown: true, title: 'Group & Enrolled Members', headerStyle: { backgroundColor: Colors.navy.primary }, headerTintColor: Colors.white }}
            />
            <Stack.Screen
              name="CustomerDetail"
              component={CustomerDetailScreen}
              options={{ headerShown: true, title: 'Member Profile', headerStyle: { backgroundColor: Colors.navy.primary }, headerTintColor: Colors.white }}
            />
            <Stack.Screen
              name="CustomerSchedule"
              component={CustomerScheduleScreen}
              options={{ headerShown: true, title: 'Installment Breakdown', headerStyle: { backgroundColor: Colors.navy.primary }, headerTintColor: Colors.white }}
            />
            <Stack.Screen
              name="ReceiptEntry"
              component={ReceiptEntryScreen}
              options={{ headerShown: true, title: 'Receipt Desk & Collections', headerStyle: { backgroundColor: Colors.navy.primary }, headerTintColor: Colors.white }}
            />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{ headerShown: true, title: 'Notifications & Alerts', headerStyle: { backgroundColor: Colors.navy.primary }, headerTintColor: Colors.white }}
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
    backgroundColor: Colors.navy.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
