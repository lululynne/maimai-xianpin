'use strict';
// 手机宽度直接进正式界面；桌面显示 390×844 手机框。
if (matchMedia('(max-width:520px)').matches) location.replace('/');
document.addEventListener('DOMContentLoaded', () => document.getElementById('restart').addEventListener('click', () => { document.getElementById('screen').src = '/'; }));
