import { Card, IconTile, Loader, Screen, T } from '@/components/cpace-ui';
import { CPACE, Radius } from '@/constants/theme';
import { api } from '@/lib/api';
import type { ReviewDue } from '@/lib/types';
import { FontAwesome6 } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

const STATUS = {
  due: { label: 'Due today', color: CPACE.accent, bg: CPACE.redBg, icon: 'bell' },
  upcoming: { label: 'Upcoming', color: CPACE.blue, bg: CPACE.blueBg, icon: 'clock' },
  done: { label: 'Completed', color: CPACE.green, bg: CPACE.greenBg, icon: 'check' },
} as const;

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Local yyyy-mm-dd key (toISOString would shift across timezones).
function isoKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function todayKey() {
  const t = new Date();
  return isoKey(t.getFullYear(), t.getMonth(), t.getDate());
}

// Weeks of a month as a 6x7-max grid; null cells pad around the 1st and last day.
function monthGrid(year: number, month: number): (number | null)[][] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function prettyDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function CalendarScreen() {
  const [items, setItems] = useState<ReviewDue[] | null>(null);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-based
  const [selected, setSelected] = useState(todayKey());

  useEffect(() => {
    setItems(null);
    api.getReviewSchedule(`${year}-${String(month + 1).padStart(2, '0')}`).then(setItems);
  }, [year, month]);

  const byDate = useMemo(() => {
    const map = new Map<string, ReviewDue[]>();
    (items ?? []).forEach((it) => {
      if (!map.has(it.date)) map.set(it.date, []);
      map.get(it.date)!.push(it);
    });
    return map;
  }, [items]);

  if (!items) return <Screen><Loader /></Screen>;

  const dueCount = items.filter((i) => i.status === 'due').reduce((s, i) => s + i.itemsDue, 0);
  const weeks = monthGrid(year, month);
  const tKey = todayKey();
  const selectedItems = byDate.get(selected) ?? [];

  const changeMonth = (dir: -1 | 1) => {
    const d = new Date(year, month + dir, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.summary}>
          <IconTile name="repeat" color={CPACE.primary} bg={CPACE.primaryLight} tile={48} size={20} />
          <View style={{ flex: 1 }}>
            <T weight="semibold" size={15}>
              Spaced Repetition
            </T>
            <T size={12} color={CPACE.gray500}>
              {dueCount} item{dueCount === 1 ? '' : 's'} due for review today
            </T>
          </View>
        </Card>

        {/* Month calendar */}
        <Card style={{ marginTop: 16 }}>
          <View style={styles.monthHeader}>
            <Pressable style={styles.navBtn} onPress={() => changeMonth(-1)} hitSlop={8}>
              <FontAwesome6 name="chevron-left" size={13} color={CPACE.gray700} />
            </Pressable>
            <T weight="semibold" size={15}>
              {MONTH_NAMES[month]} {year}
            </T>
            <Pressable style={styles.navBtn} onPress={() => changeMonth(1)} hitSlop={8}>
              <FontAwesome6 name="chevron-right" size={13} color={CPACE.gray700} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((w, i) => (
              <View key={i} style={styles.dayCell}>
                <T weight="semibold" size={11} color={CPACE.gray400}>
                  {w}
                </T>
              </View>
            ))}
          </View>

          {weeks.map((week, wi) => (
            <View key={wi} style={styles.weekRow}>
              {week.map((day, di) => {
                if (day === null) return <View key={di} style={styles.dayCell} />;
                const key = isoKey(year, month, day);
                const dayItems = byDate.get(key) ?? [];
                const isToday = key === tKey;
                const isSelected = key === selected;
                return (
                  <Pressable key={di} style={styles.dayCell} onPress={() => setSelected(key)}>
                    <View
                      style={[
                        styles.dayCircle,
                        isToday && !isSelected && styles.dayToday,
                        isSelected && styles.daySelected,
                      ]}
                    >
                      <T
                        weight={isToday || isSelected ? 'semibold' : 'regular'}
                        size={13}
                        color={isSelected ? '#fff' : isToday ? CPACE.primary : CPACE.gray900}
                      >
                        {day}
                      </T>
                    </View>
                    <View style={styles.dotRow}>
                      {dayItems.slice(0, 3).map((it) => (
                        <View key={it.id} style={[styles.dot, { backgroundColor: STATUS[it.status].color }]} />
                      ))}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}

          <View style={styles.legend}>
            {(Object.keys(STATUS) as (keyof typeof STATUS)[]).map((k) => (
              <View key={k} style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: STATUS[k].color }]} />
                <T size={11} color={CPACE.gray500}>
                  {STATUS[k].label}
                </T>
              </View>
            ))}
          </View>
        </Card>

        {/* Selected day details */}
        <T weight="semibold" size={13} color={CPACE.gray700} style={{ marginTop: 18, marginBottom: 10 }}>
          {prettyDate(selected)}
        </T>
        {selectedItems.length === 0 ? (
          <Card style={styles.empty}>
            <FontAwesome6 name="calendar-check" size={22} color={CPACE.gray400} />
            <T size={12} color={CPACE.gray500} style={{ marginTop: 8 }}>
              No reviews scheduled for this day
            </T>
          </Card>
        ) : (
          <View style={{ gap: 10 }}>
            {selectedItems.map((it) => {
              const s = STATUS[it.status];
              return (
                <Card key={it.id} style={styles.itemCard}>
                  <IconTile name={s.icon} color={s.color} bg={s.bg} tile={40} />
                  <View style={{ flex: 1 }}>
                    <T weight="semibold" size={13}>
                      {it.topic}
                    </T>
                    <T size={11} color={CPACE.gray500}>
                      {it.subjectCode} · {it.itemsDue} items
                    </T>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
                    <T weight="semibold" size={10} color={s.color}>
                      {s.label}
                    </T>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 28 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: CPACE.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekRow: { flexDirection: 'row' },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayToday: { borderWidth: 1.5, borderColor: CPACE.primary },
  daySelected: { backgroundColor: CPACE.primary },
  dotRow: { flexDirection: 'row', gap: 3, height: 5, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: CPACE.divider,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  empty: { alignItems: 'center', paddingVertical: 26 },
  itemCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill },
});
