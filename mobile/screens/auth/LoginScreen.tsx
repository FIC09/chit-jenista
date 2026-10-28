import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../store/AuthContext';

// Clean Teal FinTech Theme Palette
const THEME = {
  bg: '#F9FBFB',
  surface: '#FFFFFF',
  tealPrimary: '#0C8A7D',
  tealDark: '#086359',
  tealLight: '#E8F5F3',
  tealBorder: '#D2EBE6',
  textDark: '#133336',
  textMuted: '#7E9596',
  inputBg: '#FFFFFF',
  inputBorder: '#D8E4E5',
  inputBorderFocused: '#0C8A7D',
  danger: '#DC4545',
  dangerLight: '#FDECEC',
};

export const LoginScreen: React.FC = () => {
  const { loginAsCustomer, loginAsAdminOrStaff } = useAuth();

  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [authRole, setAuthRole] = useState<'CUSTOMER' | 'ADMIN_STAFF'>('CUSTOMER');

  const handleLogin = async () => {
    const trimmedInput = mobileNumber.trim();
    if (!trimmedInput) {
      setError(authRole === 'CUSTOMER' ? 'Please enter your mobile number' : 'Please enter username or staff ID');
      return;
    }
    if (!password.trim()) {
      setError('Please enter your password or PIN');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      if (authRole === 'ADMIN_STAFF') {
        await loginAsAdminOrStaff(trimmedInput, password);
        return;
      }

      // Customer login attempt
      try {
        await loginAsCustomer(trimmedInput, password);
        return;
      } catch (custErr: any) {
        // Fallback: if user typed admin/staff credentials
        const lower = trimmedInput.toLowerCase();
        if (lower === 'admin' || lower === 'staff') {
          await loginAsAdminOrStaff(trimmedInput, password);
          return;
        }
        throw custErr;
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Centered Credential Content Box */}
        <View style={styles.centerContainer}>
          {/* Brand Header */}
          <View style={styles.brandContainer}>
            <View style={styles.logoBadge}>
              <Image
                source={require('../../assets/Golden Tree Emblem Logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brandTitle}>Jenista Chits</Text>
            <Text style={styles.brandTagline}>
              {authRole === 'CUSTOMER'
                ? 'Smart Member & Chit Portfolio Portal'
                : 'Admin & Staff Management Portal'}
            </Text>
          </View>

          {/* Form Container */}
          <View style={styles.formContainer}>
            {/* Error Message */}
            {!!error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={18} color={THEME.danger} />
                <Text style={styles.errorMessage}>{error}</Text>
              </View>
            )}

            {/* Input 1: Identifier */}
            <View style={styles.inputBox}>
              <TextInput
                placeholder={authRole === 'CUSTOMER' ? 'Mobile Number' : 'Username / Staff ID'}
                placeholderTextColor={THEME.textMuted}
                keyboardType={authRole === 'CUSTOMER' ? 'phone-pad' : 'default'}
                autoCapitalize="none"
                value={mobileNumber}
                onChangeText={(val: string) => {
                  setMobileNumber(val);
                  if (error) setError('');
                }}
                style={styles.textInput}
              />
            </View>

            {/* Input 2: Password */}
            <View style={styles.inputBox}>
              <TextInput
                placeholder="Password"
                placeholderTextColor={THEME.textMuted}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(val: string) => {
                  setPassword(val);
                  if (error) setError('');
                }}
                style={[styles.textInput, { paddingRight: 40 }]}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color={THEME.textMuted}
                />
              </TouchableOpacity>
            </View>

            {/* Primary Action Button: Sign In */}
            <TouchableOpacity
              style={styles.actionBtn}
              activeOpacity={0.88}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.actionBtnText}>
                    {authRole === 'CUSTOMER' ? 'Sign In' : 'Sign In as Staff / Admin'}
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={styles.actionBtnIcon} />
                </>
              )}
            </TouchableOpacity>

            {/* Links Row below Sign In: Left side Forgot Password?, Right side Switcher */}
            <View style={styles.linksRow}>
              <TouchableOpacity
                onPress={() => {
                  setError('Please contact your chit manager or branch office to reset credentials.');
                }}
              >
                <Text style={styles.linkText}>Forgot Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setAuthRole((prev) => (prev === 'CUSTOMER' ? 'ADMIN_STAFF' : 'CUSTOMER'));
                  setError('');
                }}
              >
                <Text style={styles.linkText}>
                  {authRole === 'CUSTOMER' ? 'Admin / Staff Login' : 'Customer Login'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Right Chit Fund Illustration Accent - Absolute to safeArea with pointerEvents none */}
      <View style={styles.bottomIllustrationContainer} pointerEvents="none">
        <Image
          source={require('../../assets/chit_fund_pot.png')}
          style={styles.cornerIllustration}
          resizeMode="contain"
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.bg,
    position: 'relative',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 30,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  centerContainer: {
    width: '100%',
    justifyContent: 'center',
    zIndex: 2,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    overflow: 'hidden',
  },
  logoImage: {
    width: 72,
    height: 72,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: THEME.tealDark,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  brandTagline: {
    fontSize: 13,
    color: THEME.textMuted,
    marginTop: 4,
    fontWeight: '500',
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.dangerLight,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorMessage: {
    flex: 1,
    color: THEME.danger,
    fontSize: 13,
    fontWeight: '500',
  },
  inputBox: {
    backgroundColor: THEME.inputBg,
    borderColor: THEME.inputBorder,
    borderWidth: 1.2,
    borderRadius: 12,
    height: 54,
    marginBottom: 16,
    justifyContent: 'center',
    paddingHorizontal: 16,
    position: 'relative',
  },
  textInput: {
    height: '100%',
    fontSize: 15,
    color: THEME.textDark,
    fontWeight: '500',
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtn: {
    backgroundColor: THEME.tealPrimary,
    borderRadius: 12,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: THEME.tealPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  actionBtnIcon: {
    marginLeft: 8,
  },
  linksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
    paddingHorizontal: 4,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.tealPrimary,
  },
  bottomIllustrationContainer: {
    position: 'absolute',
    bottom: -15,
    right: -15,
    zIndex: 1,
  },
  cornerIllustration: {
    width: 145,
    height: 145,
    opacity: 0.95,
  },
});


