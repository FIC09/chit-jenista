import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useAuth } from '../../store/AuthContext';

export const CustomerSupportScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { logout } = useAuth();
  const helplineNumber = '+919876543210';
  const whatsappNumber = '919876543210';
  const supportEmail = 'support@jenistachits.com';

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const handleCall = () => {
    Linking.openURL(`tel:${helplineNumber}`).catch(() => {
      Alert.alert('Notice', 'Unable to initiate call. Helpline: +91 98765 43210');
    });
  };

  const handleWhatsApp = () => {
    Linking.openURL(
      `https://wa.me/${whatsappNumber}?text=Hello%20Jenista%20Chits,%20I%20am%20a%20registered%20chit%20member%20and%20need%20assistance.`
    ).catch(() => {
      Alert.alert('Notice', 'WhatsApp application is not installed on this device.');
    });
  };

  const handleEmail = () => {
    Linking.openURL(`mailto:${supportEmail}?subject=Member%20Support%20Request`).catch(() => {
      Alert.alert('Notice', `Please mail us directly at ${supportEmail}`);
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Hero Support Card */}
      <View style={styles.heroCard}>
        <View style={styles.iconCircle}>
          <Ionicons name="headset" size={32} color={Colors.gold.primary} />
        </View>
        <Text style={styles.heroTitle}>How can we assist you today?</Text>
        <Text style={styles.heroSub}>
          Jenista Chit Funds customer care and branch executives are available to help you with your subscriptions, payments, and prize disbursals.
        </Text>
        <View style={styles.hoursBadge}>
          <Ionicons name="time-outline" size={14} color="#065f46" />
          <Text style={styles.hoursText}>Mon – Sat: 9:00 AM – 6:30 PM IST</Text>
        </View>
      </View>

      <Text style={styles.sectionHeader}>Direct Contact Channels</Text>

      {/* Call Helpline */}
      <TouchableOpacity style={styles.channelCard} onPress={handleCall} activeOpacity={0.8}>
        <View style={[styles.channelIcon, { backgroundColor: '#e0f2fe' }]}>
          <Ionicons name="call" size={22} color="#0284c7" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.channelLabel}>PHONE HELPLINE</Text>
          <Text style={styles.channelValue}>+91 98765 43210</Text>
          <Text style={styles.channelSub}>Instant connection with relationship manager</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.border} />
      </TouchableOpacity>

      {/* WhatsApp Chat */}
      <TouchableOpacity style={styles.channelCard} onPress={handleWhatsApp} activeOpacity={0.8}>
        <View style={[styles.channelIcon, { backgroundColor: '#dcfce7' }]}>
          <Ionicons name="logo-whatsapp" size={22} color="#16a34a" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.channelLabel}>WHATSAPP BUSINESS</Text>
          <Text style={[styles.channelValue, { color: '#15803d' }]}>Chat on WhatsApp</Text>
          <Text style={styles.channelSub}>Share payment slips, queries & statements</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.border} />
      </TouchableOpacity>

      {/* Official Email */}
      <TouchableOpacity style={styles.channelCard} onPress={handleEmail} activeOpacity={0.8}>
        <View style={[styles.channelIcon, { backgroundColor: '#fef3c7' }]}>
          <Ionicons name="mail" size={22} color="#d97706" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.channelLabel}>EMAIL INQUIRIES</Text>
          <Text style={styles.channelValue}>support@jenistachits.com</Text>
          <Text style={styles.channelSub}>Official policy queries and formal responses</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.border} />
      </TouchableOpacity>

      {/* Branch Office Details */}
      <Text style={[styles.sectionHeader, { marginTop: 12 }]}>Registered Head Office</Text>

      <View style={styles.officeCard}>
        <View style={styles.officeHeader}>
          <Ionicons name="business" size={20} color="#0C8A7D" />
          <Text style={styles.officeTitle}>Jenista Chit Funds Pvt. Ltd.</Text>
        </View>
        <Text style={styles.officeAddress}>
          No. 42, Harbor Main Road, Commercial Complex,{'\n'}
          Thoothukudi – 628001, Tamil Nadu, India.
        </Text>
        <View style={styles.officeMetaRow}>
          <Text style={styles.officeMeta}>CIN: U67190TZ2020PTC033361</Text>
          <Text style={styles.officeMeta}>Foreman Reg: FR-TN-2020-0042</Text>
        </View>
      </View>

      {/* Account Logout Action */}
      <TouchableOpacity
        style={styles.logoutCardBtn}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <Ionicons name="log-out-outline" size={20} color="#DC2626" />
        <Text style={styles.logoutCardBtnText}>Log Out from Account</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  heroCard: {
    backgroundColor: Colors.navy.primary,
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    marginBottom: 8,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
    textAlign: 'center',
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  hoursBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#d1fae5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 14,
  },
  hoursText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065f46',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.navy.primary,
    marginTop: 6,
    letterSpacing: 0.3,
  },
  channelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 14,
  },
  channelIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  channelValue: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.navy.primary,
    marginTop: 2,
  },
  channelSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  officeCard: {
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  officeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  officeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.navy.primary,
  },
  officeAddress: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  officeMetaRow: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
    gap: 2,
  },
  officeMeta: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  logoutCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF1F2',
    borderWidth: 1.5,
    borderColor: '#FECDD3',
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 8,
  },
  logoutCardBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#DC2626',
  },
});
