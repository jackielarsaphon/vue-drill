import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from './router/index.ts';
import App from './App.vue';
import './layout/styles.css';

createApp(App).use(createPinia()).use(router).mount('#app');
