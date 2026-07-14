// Shared building blocks for the Login / Signup screens.

import { T } from '@/components/cpace-ui';
import { CPACE, Font, Radius } from '@/constants/theme';
import { FontAwesome6, Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';

export function Field({
  icon,
  secure,
  ...rest
}: TextInputProps & { icon: string; secure?: boolean }) {
  const [hidden, setHidden] = useState(!!secure);
  return (
    <View style={styles.field}>
      <FontAwesome6 name={icon} size={15} color={CPACE.gray500} style={{ width: 20, textAlign: 'center' }} />
      <TextInput
        {...rest}
        secureTextEntry={hidden}
        placeholderTextColor={CPACE.gray400}
        style={styles.input}
      />
      {secure ? (
        <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10}>
          <FontAwesome6 name={hidden ? 'eye' : 'eye-slash'} size={15} color={CPACE.gray500} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.primaryBtn,
        (disabled || loading) && { opacity: 0.6 },
        pressed && { backgroundColor: CPACE.primaryHover },
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <T weight="semibold" size={15} color="#fff">
          {label}
        </T>
      )}
    </Pressable>
  );
}

export function SocialButton({ icon, label, color, onPress }: { icon: any; label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.social, pressed && { backgroundColor: CPACE.gray100 }]}>
      <Ionicons name={icon} size={18} color={color} />
      <T weight="medium" size={13} color={CPACE.gray700}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: CPACE.gray300,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    height: 50,
  },
  input: { flex: 1, fontFamily: Font.regular, fontSize: 14, color: CPACE.gray900, height: '100%' },
  primaryBtn: {
    height: 50,
    borderRadius: Radius.md,
    backgroundColor: CPACE.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  social: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: CPACE.gray300,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
