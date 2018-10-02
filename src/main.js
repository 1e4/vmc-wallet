import Vue from 'vue'
import App from './App.vue'
import router from './router'
import io from 'socket.io-client'

Vue.config.productionTip = false;

window.$user = io('http://35.204.157.208:8000/user');

new Vue({
    router,
    render: h => h(App)
}).$mount('#app')
