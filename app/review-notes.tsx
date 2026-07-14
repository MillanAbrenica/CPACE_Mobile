import { Card, IconTile, Loader, Pill, Screen, T } from '@/components/cpace-ui';
import { CPACE, Font, Radius } from '@/constants/theme';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import type { ReviewNote } from '@/lib/types';
import { FontAwesome6 } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

const SUBJECTS = ['FAR', 'AFAR', 'MS', 'TAX', 'AUD', 'RFBT'];

export default function ReviewNotesScreen() {
  const [notes, setNotes] = useState<ReviewNote[] | null>(null);
  const [editing, setEditing] = useState<ReviewNote | null>(null);
  const [open, setOpen] = useState(false);

  const load = () => api.getReviewNotes().then(setNotes);
  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (n: ReviewNote) => {
    setEditing(n);
    setOpen(true);
  };

  const remove = (n: ReviewNote) => {
    Alert.alert('Delete note', `Delete "${n.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await api.deleteReviewNote(n.id);
          load();
        },
      },
    ]);
  };

  const toggleFav = async (n: ReviewNote) => {
    await api.toggleFavorite(n.id);
    load();
  };

  if (!notes) return <Screen><Loader /></Screen>;

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={openNew} hitSlop={10} style={{ marginRight: 4 }}>
              <FontAwesome6 name="plus" size={18} color="#fff" />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {notes.length === 0 ? (
          <View style={styles.empty}>
            <FontAwesome6 name="note-sticky" size={40} color={CPACE.gray300} />
            <T size={14} color={CPACE.gray500} style={{ marginTop: 12 }}>
              No notes yet. Tap + to add one.
            </T>
          </View>
        ) : (
          notes.map((n) => (
            <Card key={n.id} style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Pill label={n.subjectCode} />
                <T size={11} color={CPACE.gray400} style={{ flex: 1 }}>
                  {timeAgo(n.updatedAt)}
                </T>
                <Pressable onPress={() => toggleFav(n)} hitSlop={8}>
                  <FontAwesome6 name="star" size={16} color={n.favorite ? CPACE.orange : CPACE.gray300} solid={n.favorite} />
                </Pressable>
              </View>
              <T weight="semibold" size={15} style={{ marginBottom: 4 }}>
                {n.title}
              </T>
              <T size={13} color={CPACE.gray700} style={{ lineHeight: 20 }}>
                {n.body}
              </T>
              <View style={styles.actions}>
                <Pressable style={styles.actionBtn} onPress={() => openEdit(n)}>
                  <FontAwesome6 name="pen" size={12} color={CPACE.primary} />
                  <T size={12} weight="medium" color={CPACE.primary}>
                    Edit
                  </T>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => remove(n)}>
                  <FontAwesome6 name="trash" size={12} color={CPACE.danger} />
                  <T size={12} weight="medium" color={CPACE.danger}>
                    Delete
                  </T>
                </Pressable>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <NoteEditor
        visible={open}
        note={editing}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          load();
        }}
      />
    </Screen>
  );
}

function NoteEditor({
  visible,
  note,
  onClose,
  onSaved,
}: {
  visible: boolean;
  note: ReviewNote | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('FAR');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle(note?.title ?? '');
      setSubject(note?.subjectCode ?? 'FAR');
      setBody(note?.body ?? '');
    }
  }, [visible, note]);

  const save = async () => {
    if (!title.trim()) {
      Alert.alert('Missing title', 'Please enter a title.');
      return;
    }
    setSaving(true);
    await api.saveReviewNote({ id: note?.id, title: title.trim(), subjectCode: subject, body: body.trim() });
    setSaving(false);
    onSaved();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHandle} />
          <T weight="bold" size={18} style={{ marginBottom: 16 }}>
            {note ? 'Edit Note' : 'New Note'}
          </T>

          <T size={12} weight="medium" color={CPACE.gray700} style={{ marginBottom: 6 }}>
            Title
          </T>
          <TextInput value={title} onChangeText={setTitle} placeholder="e.g. LCNRV rules" placeholderTextColor={CPACE.gray400} style={styles.input} />

          <T size={12} weight="medium" color={CPACE.gray700} style={{ marginTop: 14, marginBottom: 6 }}>
            Subject
          </T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {SUBJECTS.map((s) => (
              <Pressable key={s} onPress={() => setSubject(s)} style={[styles.subChip, subject === s && styles.subChipActive]}>
                <T size={12} weight="medium" color={subject === s ? '#fff' : CPACE.gray700}>
                  {s}
                </T>
              </Pressable>
            ))}
          </ScrollView>

          <T size={12} weight="medium" color={CPACE.gray700} style={{ marginTop: 14, marginBottom: 6 }}>
            Note
          </T>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Write your study note..."
            placeholderTextColor={CPACE.gray400}
            multiline
            style={[styles.input, { height: 110, textAlignVertical: 'top' }]}
          />

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
            <Pressable style={[styles.modalBtn, styles.cancelBtn]} onPress={onClose}>
              <T weight="semibold" size={14} color={CPACE.gray700}>
                Cancel
              </T>
            </Pressable>
            <Pressable style={[styles.modalBtn, styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
              <T weight="semibold" size={14} color="#fff">
                {saving ? 'Saving...' : 'Save'}
              </T>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 28, gap: 12 },
  empty: { alignItems: 'center', paddingVertical: 80 },
  card: {},
  actions: { flexDirection: 'row', gap: 18, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: CPACE.divider },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22, paddingBottom: 34 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: CPACE.gray300, alignSelf: 'center', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: CPACE.gray300,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: Font.regular,
    fontSize: 14,
    color: CPACE.gray900,
  },
  subChip: { paddingHorizontal: 16, height: 36, borderRadius: Radius.pill, borderWidth: 1, borderColor: CPACE.gray300, alignItems: 'center', justifyContent: 'center' },
  subChipActive: { backgroundColor: CPACE.primary, borderColor: CPACE.primary },
  modalBtn: { flex: 1, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { backgroundColor: CPACE.gray200 },
  saveBtn: { backgroundColor: CPACE.primary },
});
