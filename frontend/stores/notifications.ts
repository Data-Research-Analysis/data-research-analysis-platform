import { defineStore } from 'pinia';
import type { INotificationData, INotificationListResponse } from '~/types/INotification';
import { io, Socket } from 'socket.io-client';

export const useNotificationStore = defineStore('notifications', {
    state: () => ({
        notifications: [] as INotificationData[],
        unreadCount: 0,
        loading: false,
        error: null as string | null,
        socket: null as Socket | null,
        initialized: false,
    }),

    getters: {
        unreadNotifications: (state) => state.notifications.filter(n => !n.isRead),
        hasUnread: (state) => state.unreadCount > 0,
        recentNotifications: (state) => state.notifications.slice(0, 10),
    },

    actions: {
        /**
         * Fetch notifications with pagination
         */
        async fetchNotifications(page = 1, limit = 20) {
            this.loading = true;
            this.error = null;

            try {
                const response = await $fetch<INotificationListResponse>('/api/notifications', {
                    params: { page, limit }
                });

                this.notifications = response.notifications;
                return response;
            } catch (err: any) {
                this.error = err.message || 'Failed to fetch notifications';
                console.error('Error fetching notifications:', err);
                throw err;
            } finally {
                this.loading = false;
            }
        },

        /**
         * Fetch unread notification count
         */
        async fetchUnreadCount() {
            try {
                const response = await $fetch<{ unreadCount: number }>('/api/notifications/unread-count');
                this.unreadCount = response.unreadCount;
                return response.unreadCount;
            } catch (err: any) {
                console.error('Error fetching unread count:', err);
                throw err;
            }
        },

        /**
         * Mark a notification as read
         */
        async markAsRead(notificationId: number) {
            try {
                await $fetch(`/api/notifications/${notificationId}/read`, {
                    method: 'PUT'
                });

                // Optimistic update
                const notification = this.notifications.find(n => n.id === notificationId);
                if (notification && !notification.isRead) {
                    notification.isRead = true;
                    notification.readAt = new Date();
                    this.unreadCount = Math.max(0, this.unreadCount - 1);
                }
            } catch (err: any) {
                console.error('Error marking notification as read:', err);
                throw err;
            }
        },

        /**
         * Mark all notifications as read
         */
        async markAllAsRead() {
            try {
                await $fetch('/api/notifications/mark-all-read', {
                    method: 'PUT'
                });

                // Optimistic update
                this.notifications.forEach(n => {
                    if (!n.isRead) {
                        n.isRead = true;
                        n.readAt = new Date();
                    }
                });
                this.unreadCount = 0;
            } catch (err: any) {
                console.error('Error marking all as read:', err);
                throw err;
            }
        },

        /**
         * Delete a notification
         */
        async deleteNotification(notificationId: number) {
            try {
                await $fetch(`/api/notifications/${notificationId}`, {
                    method: 'DELETE'
                });

                // Optimistic update
                const index = this.notifications.findIndex(n => n.id === notificationId);
                if (index !== -1) {
                    const notification = this.notifications[index];
                    if (!notification.isRead) {
                        this.unreadCount = Math.max(0, this.unreadCount - 1);
                    }
                    this.notifications.splice(index, 1);
                }
            } catch (err: any) {
                console.error('Error deleting notification:', err);
                throw err;
            }
        },

        /**
         * Initialize Socket.IO connection for real-time updates
         */
        initializeSocket(userId: number) {
            if (this.socket || this.initialized) {
                console.log('Socket already initialized');
                return;
            }

            try {
                // Get Socket.IO server URL from runtime config or fall back to localhost
                const config = useRuntimeConfig();
                const socketUrl = config.public.apiUrl || 'http://localhost:3002';

                // Connect to Socket.IO server
                this.socket = io(socketUrl, {
                    auth: { userId },
                    reconnection: true,
                    reconnectionDelay: 1000,
                    reconnectionAttempts: 5
                });

                // Connection events
                this.socket.on('connect', () => {
                    console.log('Socket.IO connected for notifications');
                    this.initialized = true;
                });

                this.socket.on('disconnect', () => {
                    console.log('Socket.IO disconnected');
                });

                this.socket.on('serverInitialization', (data) => {
                    console.log('Server initialization:', data);
                });

                // Notification events
                this.socket.on('notification:new', this.handleNewNotification);
                this.socket.on('notification:read', this.handleNotificationRead);
                this.socket.on('notification:deleted', this.handleNotificationDeleted);
                this.socket.on('notification:markAllRead', this.handleMarkAllRead);

            } catch (err) {
                console.error('Error initializing Socket.IO:', err);
            }
        },

        /**
         * Handle new notification from Socket.IO
         */
        handleNewNotification(data: { notification: INotificationData }) {
            console.log('New notification received:', data);

            // Add to beginning of array
            this.notifications.unshift(data.notification);

            // Increment unread count
            this.unreadCount++;

            // Optional: Show browser notification
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(data.notification.title, {
                    body: data.notification.message,
                    icon: '/favicon.ico'
                });
            }
        },

        /**
         * Handle notification marked as read from Socket.IO
         */
        handleNotificationRead(data: { notificationId: number; readAt: Date }) {
            console.log('Notification marked as read:', data);

            const notification = this.notifications.find(n => n.id === data.notificationId);
            if (notification && !notification.isRead) {
                notification.isRead = true;
                notification.readAt = data.readAt;
                this.unreadCount = Math.max(0, this.unreadCount - 1);
            }
        },

        /**
         * Handle notification deleted from Socket.IO
         */
        handleNotificationDeleted(data: { notificationId: number }) {
            console.log('Notification deleted:', data);

            const index = this.notifications.findIndex(n => n.id === data.notificationId);
            if (index !== -1) {
                const notification = this.notifications[index];
                if (!notification.isRead) {
                    this.unreadCount = Math.max(0, this.unreadCount - 1);
                }
                this.notifications.splice(index, 1);
            }
        },

        /**
         * Handle all notifications marked as read from Socket.IO
         */
        handleMarkAllRead(data: { timestamp: Date }) {
            console.log('All notifications marked as read:', data);

            this.notifications.forEach(n => {
                if (!n.isRead) {
                    n.isRead = true;
                    n.readAt = data.timestamp;
                }
            });
            this.unreadCount = 0;
        },

        /**
         * Disconnect Socket.IO
         */
        disconnectSocket() {
            if (this.socket) {
                this.socket.disconnect();
                this.socket = null;
                this.initialized = false;
            }
        },

        /**
         * Request browser notification permission
         */
        async requestNotificationPermission() {
            if ('Notification' in window && Notification.permission === 'default') {
                const permission = await Notification.requestPermission();
                console.log('Notification permission:', permission);
                return permission;
            }
            return Notification.permission;
        },
    }
});
