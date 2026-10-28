import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors } from '../../theme/colors';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  isLoading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  isLoading = false,
  disabled = false,
  style,
  textStyle,
  icon,
}) => {
  const isSecondary = variant === 'secondary';
  const isDanger = variant === 'danger';
  const isOutline = variant === 'outline';

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || isLoading}
      style={[
        styles.base,
        isSecondary && styles.secondary,
        isDanger && styles.danger,
        isOutline && styles.outline,
        (disabled || isLoading) && styles.disabled,
        style,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={isSecondary || isOutline ? Colors.primary[900] : Colors.white}
        />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              isSecondary && styles.secondaryText,
              isDanger && styles.dangerText,
              isOutline && styles.outlineText,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.gold.primary,
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 8,
    shadowColor: Colors.gold.dark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 2,
  },
  secondary: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  danger: {
    backgroundColor: Colors.danger,
    shadowColor: Colors.danger,
    shadowOpacity: 0.2,
    elevation: 2,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.navy.primary,
    shadowOpacity: 0,
    elevation: 0,
  },
  disabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  text: {
    color: '#133336',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  secondaryText: {
    color: Colors.navy.primary,
    fontWeight: '700',
  },
  dangerText: {
    color: Colors.white,
    fontWeight: '700',
  },
  outlineText: {
    color: Colors.navy.primary,
    fontWeight: '700',
  },
});
