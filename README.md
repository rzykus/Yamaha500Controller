# Yamaha500 controller

A simple Expo Go app that controls a Yamaha R-N500 on your home Wi-Fi. There is no login, no cloud, and no App Store build.

Default receiver IP: `192.168.68.65`  
Control URL: `POST http://IP/YamahaRemoteControl/ctrl`

This project uses Expo SDK 57, which matches the current App Store Expo Go app.

## What you need

1. This Windows PC
2. Node.js (already used to create the project)
3. An iPhone with **Expo Go** from the App Store
4. Phone, PC, and Yamaha on the **same Wi-Fi**
5. Network Standby enabled on the receiver if you want **On** to work while it is in standby

## Run it

In PowerShell:

```powershell
cd C:\Users\rzyku\Projects\Yamaha500Controller
npx expo start
```

A QR code appears in the terminal (and often in a browser tab).

On the iPhone:

1. Open the **Expo Go** app (or the Camera app).
2. Scan the QR code.
3. When iOS asks for **Local Network** permission, tap **Allow**. Expo Go needs that to talk to the receiver.
4. Wait for the app to load.

If the QR code does not scan, make sure the PC and iPhone are on the same Wi-Fi, then press `s` in the terminal to switch to Expo Go and try again. You can also type the URL shown in the terminal into Expo Go.

## In the app

1. Confirm the receiver IP (default `192.168.68.65`) and tap **Save**.
2. Tap **Refresh** if status is empty.
3. Use **On** / **Standby**, **Volume − / +**, **Mute**, and the input buttons.

After every command the app fetches status again. Volume is shown in dB (`Val / 10`, so `-275` means `-27.5 dB`).

If a request fails, the app shows:

**Check Wi-Fi, IP, and Local Network permission for Expo Go.**

## Local Network permission later

iPhone Settings → Expo Go → Local Network → On.
