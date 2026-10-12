# The Cuisine Story: Website & QR Table Ordering

## What's included

| Page | Who uses it | What it does |
|---|---|---|
| `index.html` | Everyone | Restaurant website: home, menu with photos, gallery, about, table booking, contact |
| `order.html?table=N` | Guests at a table | Opened by scanning the table QR. Browse the menu, add to cart, place an order, call a waiter, ask for the bill, track order status |
| `kitchen.html` | Kitchen & waiters | Live order board with sound and pop-up alerts. Move orders New → Preparing → Ready → Served. Shows waiter and bill calls |
| `qr.html` | Owner | Generates printable QR codes, one per table |

## Daily use (restaurant WiFi, no internet hosting needed)

1. **First time only:** right-click `start-server.bat` and choose **Run as administrator**.
   This lets phones on the WiFi reach the computer. Also make sure Windows has the WiFi network
   set to **Private** (Settings → Network → your WiFi → Private).
2. **Every day:** double-click `start-server.bat` and keep the window open.
   It shows the addresses, for example `http://192.168.1.20:8080/`.
3. On the counter or kitchen computer, open `http://localhost:8080/kitchen.html` and enter the PIN (default `1234`).
   Click **Enable pop-ups** once, and keep the sound on.
4. Open `http://localhost:8080/qr.html` and generate and print the table QR codes.
   It fills in the WiFi address automatically.

**Guests must be connected to the restaurant WiFi** for the QR codes to work in this mode.
Put the WiFi name and password on the QR card.

> The computer should have a fixed local IP address (set a "DHCP reservation" in the WiFi router).
> Otherwise the address can change and the printed QR codes stop working.

Orders are saved in `data\tickets.json`, and the last 2 days are kept.

## Change the PIN

Edit `server.ps1` and change `[string]$StaffPin = "1234"`.

## Edit the menu and prices

Everything is in `menu-data.js`, used by both the website and the QR ordering page.
**The prices there are placeholders. Please update them to the real menu.**
To add a photo, put it in `images/food/` and set `img: "images/food/your-photo.jpg"`.

## Working over mobile data (online hosting, optional)

To let guests order without joining the WiFi, host the site online (for example Firebase Hosting or Netlify)
and use Firebase for the orders:

1. Create a free project at https://console.firebase.google.com and add a **Web app**.
2. Enable **Cloud Firestore**.
3. Paste the config into `firebase-config.js` and set `window.STAFF_PIN`.
4. Upload the site, open `/qr.html` on the live site and print the QR codes.

Note: in Firebase mode the staff PIN is only checked in the browser. For real security, add
Firebase Authentication for staff and Firestore security rules (guests may only *create* tickets;
only signed-in staff may read all tickets and update them).

## Table bookings

The **Book a Table** form saves the booking in the guest's browser and opens WhatsApp with the
details pre-filled, sent to +91 63646 98860, so the restaurant can confirm.

## Photos

Photos were taken from the restaurant's public Zomato / Swiggy listings. `_unused_photos/` holds
pictures that were left out: cake/donut photos that look like they're from the neighbouring cake shop,
and interior shots that may be from a different branch. Delete that folder if not needed.
