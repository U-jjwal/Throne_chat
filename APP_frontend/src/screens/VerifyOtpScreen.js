import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, StatusBar, useColorScheme,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const LIGHT = {
  bg: '#F2F2F7',
  card: '#FFFFFF',
  accent: '#5856D6',
  accentDim: 'rgba(88,86,214,0.12)',
  text: '#1C1C1E',
  sub: '#6C6C70',
  placeholder: '#AEAEB2',
  border: 'rgba(0,0,0,0.08)',
  boxBg: '#F2F2F7',
  boxBorder: '#E5E5EA',
};
const DARK = {
  bg: '#000000',
  card: '#1C1C1E',
  accent: '#6362E8',
  accentDim: 'rgba(99,98,232,0.20)',
  text: '#FFFFFF',
  sub: '#8E8E93',
  placeholder: '#636366',
  border: 'rgba(255,255,255,0.08)',
  boxBg: '#2C2C2E',
  boxBorder: '#38383A',
};

export default function VerifyOtpScreen({ route, navigation }) {
  const { email } = route.params;
  const scheme = useColorScheme();
  const C = scheme === 'dark' ? DARK : LIGHT;
  const isDark = scheme === 'dark';

  // 6 individual digit inputs
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const inputs = useRef([]);

  const otp = digits.join('');

  // handle digit input
  const handleDigit = (val, idx) => {
    const d = [...digits];
    d[idx] = val.replace(/[^0-9]/g, '').slice(-1);
    setDigits(d);
    if (val && idx < 5) inputs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (e, idx) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  // verify otp and create account
  const handleVerify = async () => {
    if (otp.length !== 6) {
      Alert.alert('Incomplete OTP', 'Please enter all 6 digits.');
      return;
    }
    setLoading(true);
    try {
      const response = await api.post('/auth/verify-otp', { email, otp });
      await AsyncStorage.setItem('token', response.data.token);
      await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
      navigation.replace('Chat');
    } catch (error) {
      Alert.alert('Verification Failed', error.response?.data?.message || 'Invalid OTP');
      setDigits(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(b.length) + c);

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Back */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backBtn}
        activeOpacity={0.7}
      >
        <Text style={[styles.backText, { color: C.accent }]}>‹  Back</Text>
      </TouchableOpacity>

      <View style={styles.inner}>
        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: C.accentDim }]}>
          <Text style={styles.icon}>✉️</Text>
        </View>

        <Text style={[styles.title, { color: C.text }]}>Check your email</Text>
        <Text style={[styles.subtitle, { color: C.sub }]}>
          We sent a 6-digit code to{'\n'}
          <Text style={[styles.emailBold, { color: C.text }]}>{maskedEmail}</Text>
        </Text>

        {/* OTP Boxes */}
        <View style={styles.boxRow}>
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={(r) => (inputs.current[i] = r)}
              style={[
                styles.box,
                {
                  backgroundColor: C.boxBg,
                  borderColor: d ? C.accent : C.boxBorder,
                  color: C.text,
                  borderWidth: d ? 2 : 1.5,
                },
              ]}
              value={d}
              onChangeText={(v) => handleDigit(v, i)}
              onKeyPress={(e) => handleKeyDown(e, i)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              selectTextOnFocus
            />
          ))}
        </View>

        {/* Verify */}
        <TouchableOpacity
          style={[
            styles.primaryBtn,
            { backgroundColor: C.accent },
            (otp.length < 6 || loading) && styles.btnDisabled,
          ]}
          onPress={handleVerify}
          disabled={otp.length < 6 || loading}
          activeOpacity={0.82}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.primaryBtnText}>Verify & Continue</Text>
          }
        </TouchableOpacity>

        {/* Resend */}
        <View style={styles.resendRow}>
          <Text style={[styles.resendHint, { color: C.sub }]}>Didn't get it? </Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={[styles.resendLink, { color: C.accent }]}>Resend code</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBtn: { paddingTop: 56, paddingHorizontal: 24, marginBottom: 8 },
  backText: { fontSize: 17, fontWeight: '500' },

  inner: { flex: 1, paddingHorizontal: 32, justifyContent: 'center', alignItems: 'center' },

  iconWrap: {
    width: 80, height: 80, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center', marginBottom: 28,
  },
  icon: { fontSize: 38 },

  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.4, marginBottom: 12 },
  subtitle: {
    fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 40,
  },
  emailBold: { fontWeight: '600' },

  boxRow: { flexDirection: 'row', gap: 10, marginBottom: 36 },
  box: {
    width: 48, height: 58, borderRadius: 14,
    fontSize: 24, fontWeight: '700',
  },

  primaryBtn: {
    width: '100%', borderRadius: 14, paddingVertical: 15, alignItems: 'center',
    shadowColor: '#5856D6', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  resendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 24 },
  resendHint: { fontSize: 14 },
  resendLink: { fontSize: 14, fontWeight: '600' },
});