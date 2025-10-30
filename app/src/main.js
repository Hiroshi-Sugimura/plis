import { mainGarminAdvice } from './mainGarminAdvice.mjs';

// Garminアドバイス取得
ipcMain.handle('getGarminAdvice', async (event, arg) => {
    try {
        const advices = await mainGarminAdvice.generateAdvice();
        sendIPCMessage("showGarminAdvice", advices);
    } catch (error) {
        console.error('getGarminAdvice error:', error);
    }
});