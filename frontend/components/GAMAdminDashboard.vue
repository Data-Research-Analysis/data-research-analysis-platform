<template>
  <div class="gam-admin-dashboard">
    <!-- Header -->
    <div class="dashboard-header">
      <h1>🎯 Google Ad Manager Dashboard</h1>
      <div class="header-actions">
        <button @click="refreshAll" :disabled="isLoading" class="btn-refresh">
          <span v-if="!isLoading">🔄 Refresh</span>
          <span v-else>⏳ Loading...</span>
        </button>
      </div>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="error-banner">
      ❌ {{ error }}
    </div>

    <!-- Stats Overview -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">📊</div>
        <div class="stat-content">
          <div class="stat-value">{{ formatNumber(stats?.totalDataSources || 0) }}</div>
          <div class="stat-label">Total Data Sources</div>
          <div class="stat-detail">{{ stats?.activeDataSources || 0 }} active ({{ activeDataSourcesPercent }}%)</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">🔄</div>
        <div class="stat-content">
          <div class="stat-value">{{ formatNumber(stats?.totalSyncs || 0) }}</div>
          <div class="stat-label">Total Syncs</div>
          <div class="stat-detail">{{ successRate }}% success rate</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">📈</div>
        <div class="stat-content">
          <div class="stat-value">{{ formatNumber(stats?.totalRecordsSynced || 0) }}</div>
          <div class="stat-label">Records Synced</div>
          <div class="stat-detail">{{ formatNumber(stats?.totalExports || 0) }} exports</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">⏱️</div>
        <div class="stat-content">
          <div class="stat-value">{{ formatDuration(stats?.avgSyncDuration || 0) }}</div>
          <div class="stat-label">Avg Sync Duration</div>
          <div class="stat-detail">{{ stats?.failedSyncs || 0 }} failures</div>
        </div>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="content-grid">
      <!-- Data Source Health -->
      <div class="dashboard-panel health-panel">
        <div class="panel-header">
          <h2>💚 Data Source Health</h2>
          <div class="health-summary">
            <span class="health-badge healthy">{{ healthyDataSources }} Healthy</span>
            <span class="health-badge warning" v-if="warningDataSources > 0">{{ warningDataSources }} Warning</span>
            <span class="health-badge error" v-if="errorDataSources > 0">{{ errorDataSources }} Error</span>
          </div>
        </div>
        <div class="panel-content">
          <div v-if="dataSourceHealth.length === 0" class="empty-state">
            No data sources configured yet
          </div>
          <div v-else class="health-list">
            <div 
              v-for="ds in dataSourceHealth" 
              :key="ds.id" 
              class="health-item"
              :class="`status-${ds.status}`"
            >
              <div class="health-icon">{{ getStatusIcon(ds.status) }}</div>
              <div class="health-info">
                <div class="health-name">{{ ds.name }}</div>
                <div class="health-details">
                  <span>{{ ds.networkCode }}</span>
                  <span v-if="ds.lastSyncAt">Last sync: {{ formatRelativeTime(ds.lastSyncAt) }}</span>
                  <span>Success rate: {{ Math.round(ds.successRate) }}%</span>
                </div>
              </div>
              <div class="health-stats">
                <div class="health-stat-item">
                  <div class="health-stat-value">{{ ds.totalSyncs }}</div>
                  <div class="health-stat-label">Syncs</div>
                </div>
                <div class="health-stat-item">
                  <div class="health-stat-value">{{ formatDuration(ds.avgDuration) }}</div>
                  <div class="health-stat-label">Avg</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Syncs -->
      <div class="dashboard-panel syncs-panel">
        <div class="panel-header">
          <h2>🔄 Recent Syncs</h2>
        </div>
        <div class="panel-content">
          <div v-if="recentSyncs.length === 0" class="empty-state">
            No recent syncs
          </div>
          <div v-else class="syncs-list">
            <div 
              v-for="sync in recentSyncs" 
              :key="sync.id" 
              class="sync-item"
              :class="`status-${sync.status.toLowerCase()}`"
            >
              <div class="sync-status">
                <span class="status-icon">{{ getStatusIcon(sync.status) }}</span>
              </div>
              <div class="sync-info">
                <div class="sync-title">{{ sync.dataSourceName }}</div>
                <div class="sync-meta">
                  <span>{{ sync.reportTypes.join(', ') }}</span>
                  <span>{{ formatRelativeTime(sync.startedAt) }}</span>
                </div>
                <div v-if="sync.error" class="sync-error">{{ sync.error }}</div>
              </div>
              <div class="sync-metrics">
                <div class="sync-metric">
                  <div class="metric-value">{{ formatNumber(sync.recordsSynced) }}</div>
                  <div class="metric-label">Records</div>
                </div>
                <div v-if="sync.duration" class="sync-metric">
                  <div class="metric-value">{{ formatDuration(sync.duration) }}</div>
                  <div class="metric-label">Duration</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="dashboard-panel activity-panel">
        <div class="panel-header">
          <h2>📋 Recent Activity</h2>
        </div>
        <div class="panel-content">
          <div v-if="recentActivity.length === 0" class="empty-state">
            No recent activity
          </div>
          <div v-else class="activity-list">
            <div 
              v-for="activity in recentActivity" 
              :key="activity.id" 
              class="activity-item"
              :class="`type-${activity.type}`"
            >
              <div class="activity-icon">{{ getActivityIcon(activity.type) }}</div>
              <div class="activity-content">
                <div class="activity-message">{{ activity.message }}</div>
                <div class="activity-meta">
                  <span v-if="activity.dataSourceName">{{ activity.dataSourceName }}</span>
                  <span>{{ formatRelativeTime(activity.timestamp) }}</span>
                </div>
              </div>
              <div class="activity-status">
                <span class="status-badge" :class="activity.status">
                  {{ getStatusIcon(activity.status) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useGAMDashboard } from '~/composables/useGAMDashboard';

const {
  stats,
  recentSyncs,
  dataSourceHealth,
  recentActivity,
  isLoading,
  error,
  successRate,
  activeDataSourcesPercent,
  healthyDataSources,
  warningDataSources,
  errorDataSources,
  refreshDashboard,
  formatDuration,
  formatNumber,
  getStatusColor,
  getStatusIcon,
  formatRelativeTime,
} = useGAMDashboard();

// Load dashboard data on mount
onMounted(() => {
  refreshDashboard();
});

// Refresh all data
const refreshAll = () => {
  refreshDashboard();
};

// Get activity icon
const getActivityIcon = (type: string): string => {
  const icons: Record<string, string> = {
    'sync': '🔄',
    'export': '📤',
    'error': '❌',
    'config_change': '⚙️',
  };
  return icons[type] || '📝';
};
</script>

<style scoped>
.gam-admin-dashboard {
  padding: 20px;
  max-width: 1600px;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.dashboard-header h1 {
  margin: 0;
  font-size: 28px;
  color: #1f2937;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.btn-refresh {
  padding: 10px 20px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: transform 0.2s;
}

.btn-refresh:hover:not(:disabled) {
  transform: translateY(-2px);
}

.btn-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-banner {
  background-color: #fee2e2;
  border-left: 4px solid #ef4444;
  padding: 15px;
  margin-bottom: 20px;
  border-radius: 4px;
  color: #7f1d1d;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  gap: 15px;
  transition: transform 0.2s;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  font-size: 36px;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  color: #1f2937;
  line-height: 1;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 5px;
}

.stat-detail {
  font-size: 12px;
  color: #9ca3af;
}

/* Content Grid */
.content-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 20px;
}

.dashboard-panel {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.panel-header {
  padding: 20px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h2 {
  margin: 0;
  font-size: 18px;
  color: #1f2937;
}

.panel-content {
  padding: 20px;
  max-height: 500px;
  overflow-y: auto;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #9ca3af;
}

/* Health Panel */
.health-summary {
  display: flex;
  gap: 10px;
}

.health-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.health-badge.healthy {
  background-color: #d1fae5;
  color: #065f46;
}

.health-badge.warning {
  background-color: #fef3c7;
  color: #92400e;
}

.health-badge.error {
  background-color: #fee2e2;
  color: #7f1d1d;
}

.health-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.health-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  transition: border-color 0.2s;
}

.health-item:hover {
  border-color: #3b82f6;
}

.health-item.status-healthy {
  border-left: 4px solid #10b981;
}

.health-item.status-warning {
  border-left: 4px solid #f59e0b;
}

.health-item.status-error {
  border-left: 4px solid #ef4444;
}

.health-item.status-inactive {
  border-left: 4px solid #9ca3af;
  opacity: 0.6;
}

.health-icon {
  font-size: 24px;
}

.health-info {
  flex: 1;
}

.health-name {
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 5px;
}

.health-details {
  display: flex;
  gap: 15px;
  font-size: 12px;
  color: #6b7280;
}

.health-stats {
  display: flex;
  gap: 20px;
}

.health-stat-item {
  text-align: center;
}

.health-stat-value {
  font-size: 18px;
  font-weight: bold;
  color: #1f2937;
}

.health-stat-label {
  font-size: 11px;
  color: #9ca3af;
}

/* Syncs Panel */
.syncs-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sync-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.sync-item.status-completed {
  border-left: 4px solid #10b981;
}

.sync-item.status-in_progress {
  border-left: 4px solid #3b82f6;
}

.sync-item.status-failed {
  border-left: 4px solid #ef4444;
}

.sync-item.status-partial {
  border-left: 4px solid #f59e0b;
}

.sync-status {
  font-size: 24px;
}

.sync-info {
  flex: 1;
}

.sync-title {
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 5px;
}

.sync-meta {
  display: flex;
  gap: 15px;
  font-size: 12px;
  color: #6b7280;
}

.sync-error {
  margin-top: 5px;
  padding: 8px;
  background-color: #fee2e2;
  border-radius: 4px;
  font-size: 12px;
  color: #7f1d1d;
}

.sync-metrics {
  display: flex;
  gap: 20px;
}

.sync-metric {
  text-align: center;
}

.metric-value {
  font-size: 18px;
  font-weight: bold;
  color: #1f2937;
}

.metric-label {
  font-size: 11px;
  color: #9ca3af;
}

/* Activity Panel */
.activity-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.activity-item:hover {
  background-color: #f9fafb;
}

.activity-icon {
  font-size: 20px;
}

.activity-content {
  flex: 1;
}

.activity-message {
  font-size: 14px;
  color: #1f2937;
  margin-bottom: 3px;
}

.activity-meta {
  display: flex;
  gap: 10px;
  font-size: 11px;
  color: #9ca3af;
}

.activity-status .status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 14px;
}

.activity-status .status-badge.success {
  background-color: #d1fae5;
}

.activity-status .status-badge.failure {
  background-color: #fee2e2;
}

.activity-status .status-badge.info {
  background-color: #dbeafe;
}

.activity-status .status-badge.warning {
  background-color: #fef3c7;
}

/* Responsive */
@media (max-width: 1200px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }
}
</style>
