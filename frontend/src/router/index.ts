import { createRouter, createWebHistory } from 'vue-router';
import AuditView from '../features/audit/AuditView.vue';
import UsersView from '../features/users/UsersView.vue';

/*
 * Web history rather than hash routing, because nginx serves index.html for any path
 * that is not a file, so a deep link and a reload both work.
 */
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/users' },
    { path: '/users', name: 'users', component: UsersView },
    { path: '/audit', name: 'audit', component: AuditView },
  ],
});
