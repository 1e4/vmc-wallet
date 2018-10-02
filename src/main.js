import Vue from 'vue'
import App from './App.vue'
import router from './router'
import io from 'socket.io-client'

Vue.config.productionTip = false;

window.$socket = io('http://35.204.157.208:8000/root');

window.$user = io('http://35.204.157.208:8000/user');

window.$socket.on("connect", () => {
    console.log("Connected");
});

window.$socket.on("event", (data) => {
    console.log(data);
});

new Vue({
    router,
    render: h => h(App)
}).$mount('#app')
