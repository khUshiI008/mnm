package com.mnm.apnapayroll

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status

/**
 * Wraps Android's SMS User Consent API (NOT the SMS Retriever API — that
 * variant is fully silent but requires an 11-char app-signature hash baked
 * into the SMS text, which would mean changing the DLT-registered template
 * smsGateway.js sends; User Consent needs neither a template change nor any
 * READ_SMS/RECEIVE_SMS permission). The moment a matching SMS arrives, the OS
 * shows its own "Allow [app] to read this message?" bottom sheet; only if the
 * user taps Allow does the app receive the message body, via onActivityResult
 * below — Deny or a 5-minute timeout falls through to the caller's own
 * fallback (manual OTP entry, already the existing behavior).
 */
class SmsConsentModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

  companion object {
    const val NAME = "SmsConsentModule"
    private const val SMS_CONSENT_REQUEST = 4321
    private const val EVENT_RECEIVED = "SmsConsent:received"
    private const val EVENT_TIMEOUT = "SmsConsent:timeout"
    private const val EVENT_DENIED = "SmsConsent:denied"
  }

  private var receiver: BroadcastReceiver? = null

  init {
    reactContext.addActivityEventListener(this)
  }

  override fun getName(): String = NAME

  @ReactMethod
  fun startListening(promise: Promise) {
    val context = reactApplicationContext
    unregisterReceiverIfNeeded()

    val newReceiver = object : BroadcastReceiver() {
      override fun onReceive(ctx: Context, intent: Intent) {
        if (SmsRetriever.SMS_RETRIEVED_ACTION != intent.action) return
        val extras = intent.extras ?: return
        val status = extras.get(SmsRetriever.EXTRA_STATUS) as? Status ?: return

        when (status.statusCode) {
          CommonStatusCodes.SUCCESS -> {
            @Suppress("DEPRECATION")
            val consentIntent = extras.getParcelable<Intent>(SmsRetriever.EXTRA_CONSENT_INTENT)
            val activity = reactApplicationContext.currentActivity
            if (consentIntent != null && activity != null) {
              try {
                // This is what actually shows the "Allow [app] to read this
                // message?" system dialog to the user — startSmsUserConsent()
                // alone only arms the listener, it doesn't prompt anything.
                activity.startActivityForResult(consentIntent, SMS_CONSENT_REQUEST)
              } catch (e: Exception) {
                sendEvent(EVENT_DENIED)
              }
            }
          }
          CommonStatusCodes.TIMEOUT -> sendEvent(EVENT_TIMEOUT)
        }
      }
    }
    receiver = newReceiver

    val filter = IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(newReceiver, filter, SmsRetriever.SEND_PERMISSION, null, Context.RECEIVER_EXPORTED)
    } else {
      context.registerReceiver(newReceiver, filter)
    }

    val client = SmsRetriever.getClient(context)
    // null sender filter — smsjust.com's sender id ("MOMnME"/"MoMnME") isn't a
    // fixed phone number the API can match against, so this listens for any
    // incoming SMS while armed (the same 5-minute window the Retriever API uses).
    val task = client.startSmsUserConsent(null)
    task.addOnSuccessListener { promise.resolve(true) }
    task.addOnFailureListener { e -> promise.reject("START_FAILED", e) }
  }

  @ReactMethod
  fun stopListening() {
    unregisterReceiverIfNeeded()
  }

  private fun unregisterReceiverIfNeeded() {
    receiver?.let {
      try {
        reactApplicationContext.unregisterReceiver(it)
      } catch (e: IllegalArgumentException) {
        // Already unregistered (e.g. consent already resolved) — fine to ignore.
      }
      receiver = null
    }
  }

  private fun sendEvent(name: String, message: String? = null) {
    if (!reactApplicationContext.hasActiveReactInstance()) return
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(name, message)
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != SMS_CONSENT_REQUEST) return
    if (resultCode == Activity.RESULT_OK && data != null) {
      val message = data.getStringExtra(SmsRetriever.EXTRA_SMS_MESSAGE)
      sendEvent(EVENT_RECEIVED, message)
    } else {
      // User tapped Deny on the consent bottom sheet, or dismissed it.
      sendEvent(EVENT_DENIED)
    }
  }

  override fun onNewIntent(intent: Intent) {}

  // Required so RN's NativeEventEmitter doesn't warn about a missing
  // addListener/removeListeners pair on this module — no-ops otherwise, the
  // actual (un)registration happens in startListening/stopListening above.
  @ReactMethod
  fun addListener(eventName: String) {}

  @ReactMethod
  fun removeListeners(count: Int) {}
}
