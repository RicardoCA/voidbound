import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./app/App.vue";
import "./app/style.css";
import "./app/mobile.css";
createApp(App).use(createPinia()).mount("#app");
