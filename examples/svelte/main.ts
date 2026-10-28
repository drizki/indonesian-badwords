import { mount } from 'svelte';
import App from './App.svelte';
import '../shared/style.css';
mount(App, { target: document.getElementById('app')! });
