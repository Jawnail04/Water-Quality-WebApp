const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.overrideWaterData = functions.firestore
  .document("waterQuality/data")
  .onWrite(async (change, context) => {
    
    // 1. Exit if the document was deleted
    if (!change.after.exists) return null;

    const newData = change.after.data();
    const beforeData = change.before.exists ? change.before.data() : {};

    // 2. INFINITE LOOP PROTECTOR
    if (newData.phLevel === beforeData.phLevel && 
        newData.tds === beforeData.tds && 
        newData.turbidity === beforeData.turbidity) {
        return null;
    }

    // Grab the exact time from Google's servers
    const serverTime = admin.firestore.FieldValue.serverTimestamp();

    // 3. Inject the timestamp back into the live document the ESP32 just updated
    const updateLivePromise = change.after.ref.update({
        timestamp: serverTime
    });

    // 4. Save a permanent copy to the history collection
    const saveHistoryPromise = admin.firestore().collection("waterQualityHistory").add({
        schoolId: "default", 
        phLevel: newData.phLevel || 0,
        turbidity: newData.turbidity || 0,
        tds: newData.tds || 0,
        timestamp: serverTime
    });

    // Run both actions simultaneously
    return Promise.all([updateLivePromise, saveHistoryPromise]);
  });