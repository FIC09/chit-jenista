import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { DataSyncManager } from '../../services/dataSync';
import { formatCurrency } from '../../utils/format';
import { ChitGroup } from '../../types';

export const ChitGroupListScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [groups, setGroups] = useState<ChitGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'CLOSED'>('ALL');

  // Add Group Modal State
  const [isAddGroupModalOpen, setIsAddGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupScheme, setNewGroupScheme] = useState<'Auction' | 'Fixed' | 'Regular'>('Auction');
  const [creatingGroup, setCreatingGroup] = useState(false);

  const fetchGroups = async () => {
    try {
      const data = await DataSyncManager.getChitGroups();
      setGroups(data);
    } catch (e) {
      console.warn('Failed to load chit groups:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('Validation Error', 'Please enter a chit group name.');
      return;
    }
    setCreatingGroup(true);
    try {
      await DataSyncManager.createChitGroup({
        name: newGroupName.trim(),
        type: newGroupScheme,
        value: 100000,
        duration: 20,
        members: 20,
      });
      setIsAddGroupModalOpen(false);
      setNewGroupName('');
      await fetchGroups();
      Alert.alert('Group Created', `Group "${newGroupName.trim()}" has been created successfully!`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create group');
    } finally {
      setCreatingGroup(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchGroups();
  };

  const activeCount = groups.filter((g) => (g.status || 'ACTIVE').toUpperCase() === 'ACTIVE').length;
  const closedCount = groups.filter((g) => (g.status || '').toUpperCase() === 'CLOSED').length;

  const filteredGroups = groups.filter((g) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'ACTIVE') return (g.status || 'ACTIVE').toUpperCase() === 'ACTIVE';
    if (statusFilter === 'CLOSED') return (g.status || '').toUpperCase() === 'CLOSED';
    return true;
  });

  const renderGroupCard = ({ item }: { item: ChitGroup }) => {
    const isClosed = (item.status || '').toUpperCase() === 'CLOSED';
    const isAuction = item.type.toUpperCase().includes('AUCTION');
    const isFixed = item.type.toUpperCase().includes('FIXED');

    // Icon background color based on scheme type
    const iconBg = isAuction
      ? Colors.purpleSubtle
      : isFixed
      ? Colors.blueSubtle
      : '#FFF8EB';

    const iconColor = isAuction
      ? Colors.purpleAccent
      : isFixed
      ? Colors.blueAccent
      : Colors.gold.dark;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('ChitGroupDetail', { group: item })}
      >
        <View style={styles.cardMainRow}>
          {/* Circular Category Icon (Reference Screen 2) */}
          <View style={[styles.groupIconWrap, { backgroundColor: iconBg }]}>
            <Ionicons
              name={isAuction ? 'hammer-outline' : isFixed ? 'layers-outline' : 'people'}
              size={20}
              color={iconColor}
            />
          </View>

          {/* Group Details */}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.groupNameText}>{item.name}</Text>
              <View style={[styles.statusBadge, isClosed ? styles.statusBadgeClosed : styles.statusBadgeActive]}>
                <Text style={[styles.statusBadgeText, isClosed ? styles.statusTextClosed : styles.statusTextActive]}>
                  {isClosed ? 'Closed' : 'Active'}
                </Text>
              </View>
            </View>

            <View style={styles.amountDueRow}>
              <Text style={styles.membersCountText}>{item.filled || 0} Enrolled Members</Text>
              <Text style={styles.nextDueText}>
                {isClosed ? 'Completed' : 'Due: 15th monthly'}
              </Text>
            </View>
          </View>

          <Ionicons name="chevron-forward" size={18} color={Colors.gold.primary} style={{ marginLeft: 6 }} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Top Filter and Add Group Bar */}
      <View style={styles.topControlRow}>
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterTab, statusFilter === 'ALL' && styles.filterTabActive]}
            onPress={() => setStatusFilter('ALL')}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterText, statusFilter === 'ALL' && styles.filterTextActive]}>
              All ({groups.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, statusFilter === 'ACTIVE' && styles.filterTabActive]}
            onPress={() => setStatusFilter('ACTIVE')}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterText, statusFilter === 'ACTIVE' && styles.filterTextActive]}>
              Active ({activeCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, statusFilter === 'CLOSED' && styles.filterTabActive]}
            onPress={() => setStatusFilter('CLOSED')}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterText, statusFilter === 'CLOSED' && styles.filterTextActive]}>
              Closed ({closedCount})
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.addGroupTopBtn}
          onPress={() => {
            setNewGroupName('');
            setNewGroupScheme('Auction');
            setIsAddGroupModalOpen(true);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={16} color={Colors.navy.primary} />
          <Text style={styles.addGroupTopText}>Add Group</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={Colors.gold.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredGroups}
          keyExtractor={(item) => item.id}
          renderItem={renderGroupCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.gold.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="layers-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No Chit Groups Found</Text>
              <Text style={styles.emptySub}>No schemes found under this filter.</Text>
            </View>
          }
        />
      )}

      {/* Add Chit Group Modal */}
      <Modal
        visible={isAddGroupModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddGroupModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Add New Chit Group</Text>
                <Text style={styles.modalSubtitle}>
                  Enter group name to create the group and start adding customers.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsAddGroupModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>GROUP NAME *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Diamond Series A or Chit Group 1"
                placeholderTextColor={Colors.textMuted}
                value={newGroupName}
                onChangeText={setNewGroupName}
                autoFocus
              />
              <Text style={styles.helperText}>
                Only group name is needed to create the group.
              </Text>

              <Text style={[styles.inputLabel, { marginTop: 16 }]}>DEFAULT SCHEME TYPE</Text>
              <View style={styles.schemeChipRow}>
                {(['Auction', 'Fixed', 'Regular'] as const).map((scheme) => {
                  const isSelected = newGroupScheme === scheme;
                  return (
                    <TouchableOpacity
                      key={scheme}
                      style={[
                        styles.schemeChip,
                        isSelected && styles.schemeChipActive,
                      ]}
                      onPress={() => setNewGroupScheme(scheme)}
                    >
                      <Text
                        style={[
                          styles.schemeChipText,
                          isSelected && styles.schemeChipTextActive,
                        ]}
                      >
                        {scheme}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.infoNoteBox}>
                <View style={styles.infoNoteHeader}>
                  <View style={styles.goldDot} />
                  <Text style={styles.infoNoteTitle}>Flexible Mixed Schemes</Text>
                </View>
                <Text style={styles.infoNoteBody}>
                  Once created, you can add customers to this group. Each customer can have their own individual scheme (Fixed, Regular, or Auction), duration, and chit value.
                </Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsAddGroupModalOpen(false)}
                disabled={creatingGroup}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.createBtn,
                  (!newGroupName.trim() || creatingGroup) && styles.createBtnDisabled,
                ]}
                onPress={handleCreateGroup}
                disabled={!newGroupName.trim() || creatingGroup}
              >
                <Text style={styles.createBtnText}>
                  {creatingGroup ? 'Creating...' : 'Create Group'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterTabActive: {
    backgroundColor: Colors.gold.primary,
    borderColor: Colors.gold.primary,
  },
  filterText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: Colors.navy.primary,
    fontWeight: '800',
  },
  addGroupTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.gold.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    shadowColor: Colors.gold.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  addGroupTopText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.navy.primary,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.navy.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  cardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeActive: {
    backgroundColor: Colors.successLight,
  },
  statusBadgeClosed: {
    backgroundColor: '#EDF2F7',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusTextActive: {
    color: Colors.success,
  },
  statusTextClosed: {
    color: Colors.textMuted,
  },
  membersCountText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  amountDueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  groupAmountText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  nextDueText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 22,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  modalCloseBtn: {
    padding: 4,
    marginLeft: 10,
  },
  modalBody: {
    paddingVertical: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textSecondary,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  helperText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 6,
  },
  schemeChipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  schemeChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  schemeChipActive: {
    backgroundColor: '#FFF8EB',
    borderColor: Colors.gold.primary,
  },
  schemeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  schemeChipTextActive: {
    color: Colors.gold.dark,
  },
  infoNoteBox: {
    backgroundColor: '#FFFBF0',
    borderWidth: 1,
    borderColor: '#FDECD2',
    borderRadius: 14,
    padding: 12,
    marginTop: 16,
  },
  infoNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  goldDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.gold.primary,
  },
  infoNoteTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.gold.dark,
  },
  infoNoteBody: {
    fontSize: 11,
    color: '#8A5D1B',
    lineHeight: 16,
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#F8FAFC',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  createBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.gold.primary,
  },
  createBtnDisabled: {
    opacity: 0.5,
  },
  createBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.navy.primary,
  },
});
