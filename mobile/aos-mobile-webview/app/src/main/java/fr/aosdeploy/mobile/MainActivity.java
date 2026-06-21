package fr.aosdeploy.mobile;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.content.SharedPreferences;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

public class MainActivity extends Activity {
    private static final String DEFAULT_AOS_URL = "http://192.168.1.57/mobile";
    private static final String PREFS = "aos_mobile";
    private static final String KEY_SERVER_URL = "server_url";
    private WebView webView;
    private String serverUrl;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setStatusBarColor(Color.rgb(5, 8, 13));
        getWindow().setNavigationBarColor(Color.rgb(5, 8, 13));

        webView = new WebView(this);
        configureWebView(webView);
        setContentView(webView);
        hideSystemBars();
        serverUrl = resolveServerUrl();
        loadAos();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView(WebView view) {
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        view.setBackgroundColor(Color.rgb(5, 8, 13));
        view.setWebChromeClient(new WebChromeClient());
        view.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                view.loadUrl(request.getUrl().toString());
                return true;
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                showOffline(description);
            }
        });
    }

    private void loadAos() {
        if (isOnline()) {
            webView.loadUrl(serverUrl);
        } else {
            showOffline("Reseau indisponible");
        }
    }

    private String resolveServerUrl() {
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        Uri data = getIntent() != null ? getIntent().getData() : null;
        String incoming = data != null ? data.toString() : null;
        if (data != null && "aosdeploy".equals(data.getScheme())) {
            incoming = data.getQueryParameter("url");
        }
        if (incoming != null && incoming.startsWith("http")) {
            String normalized = normalizeMobileUrl(incoming);
            prefs.edit().putString(KEY_SERVER_URL, normalized).apply();
            return normalized;
        }
        return prefs.getString(KEY_SERVER_URL, DEFAULT_AOS_URL);
    }

    private String normalizeMobileUrl(String value) {
        String clean = value.trim();
        if (clean.endsWith("/")) clean = clean.substring(0, clean.length() - 1);
        if (!clean.endsWith("/mobile")) clean = clean + "/mobile";
        return clean;
    }

    private boolean isOnline() {
        ConnectivityManager manager = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        NetworkInfo info = manager != null ? manager.getActiveNetworkInfo() : null;
        return info != null && info.isConnected();
    }

    private void showOffline(String detail) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setBackgroundColor(Color.rgb(5, 8, 13));
        layout.setPadding(40, 40, 40, 40);

        TextView text = new TextView(this);
        text.setText("AOS Mobile\n\nServeur inaccessible\n" + detail + "\n\nVerifie le Wi-Fi ou indique l'adresse du serveur.");
        text.setTextColor(Color.WHITE);
        text.setTextSize(20);
        text.setPadding(0, 0, 0, 28);
        layout.addView(text);

        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setText(serverUrl);
        input.setTextColor(Color.WHITE);
        input.setHintTextColor(Color.rgb(148, 163, 184));
        input.setHint("http://192.168.1.57/mobile");
        input.setTextSize(18);
        input.setPadding(18, 14, 18, 14);
        layout.addView(input, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        ));

        Button save = new Button(this);
        save.setText("ENREGISTRER ET OUVRIR");
        save.setTextSize(16);
        save.setOnClickListener(v -> {
            serverUrl = normalizeMobileUrl(input.getText().toString());
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(KEY_SERVER_URL, serverUrl).apply();
            setContentView(webView);
            loadAos();
        });
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        buttonParams.setMargins(0, 28, 0, 0);
        layout.addView(save, buttonParams);

        setContentView(layout);
    }

    private void hideSystemBars() {
        View decor = getWindow().getDecorView();
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            WindowInsetsController controller = decor.getWindowInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars());
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView != null && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }
}
