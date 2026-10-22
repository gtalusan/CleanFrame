/* Public Tizen application APIs. No Mac server, network address or credentials. */
(function () {
  'use strict';
  var IDS = {
    stremio: 'IkWsFHtOY9.Stremio', netflix: 'org.tizen.netflix-app',
    disneyplus: 'MCmYXNxgcu.DisneyPlus', youtube: '9Ur5IzDKqV.TizenYouTube',
    appletv: 'com.samsung.tv.aria-video', primevideo: 'org.tizen.primevideo',
    abciview: 'mWK87Xghap.ABCiview', sbs: 'OyE7OuxlUi.SBSOnDemand',
    applemusic: 'org.tizen.apple.apple-music'
  };
  var STREAMING = ['as6cYRgkPy.Binge', '73iTZRTc34.Stan', '5b8c3eb16b.BeamCTVDev',
    'KaLitts8bq.tenplaySamsungTizen', 'eYuOiOLYQX.KayoSports', 'Ne2ZsPWdKl.9NOW',
    '3KA0pm7a7V.TubiTV', 'rJeHak5zRg.Spotify', 'icp4AvUPiA.7plus'];
  var CONSUMER_SYSTEM = ['org.tizen.browser', 'com.microsoft.copilot'];
  var EXTRA_BRANDS = {'rJeHak5zRg.Spotify': 'spotify', '5b8c3eb16b.BeamCTVDev': 'hbomax', '3KA0pm7a7V.TubiTV': 'tubi'};
  var INTERNAL = ['adplatform.ADPlayer', 'WykOS4t4F0.cmsWebApp', '25emanual3.emanual',
    'ZODRT12q2l.WebAccountExtension', 'ByJlgt0XeD.CastSettingsApp', 'tv6pbVMQFF.PrivacyChoices'];
  var SELF = 'nClrkHome1.FrameHome';
  function api() { return window.tizen && window.tizen.application; }
  function unavailable(done) {
    done({ message: 'Open CleanFrame on the TV to use this control.', detail: 'The web preview cannot control the TV.' });
  }
  function failure(err) {
    return { message: 'The TV could not open this screen.', detail: err && (err.message || err.name) || 'Try again, or press the remote’s Home button to return to CleanFrame.' };
  }
  function bounded(done) {
    var finished = false, timer = setTimeout(function () { finish({ message: 'The TV did not respond. Please try again.' }); }, 8000);
    function finish(err, value) { if (finished) return; finished = true; clearTimeout(timer); done(err, value); }
    return finish;
  }
  function launchApp(id, done) {
    if (!api()) { unavailable(done); return; }
    var finish = bounded(done);
    try { api().launch(id, function () { finish(null); }, function (err) { finish(failure(err)); }); }
    catch (err) { finish(failure(err)); }
  }
  function launch(brand, done) {
    if (!IDS[brand]) { done({message: 'This app has no launch target.'}); return; }
    launchApp(IDS[brand], done);
  }
  /* Q90T fork: HDMI source switching replaces the Frame-only Art Mode control.
     Tizen 5.5's setSource takes the SystemInfoVideoSourceInfo object reported
     by VIDEOSOURCE, not a bare source name. */
  function source(name, done) {
    if (!window.tizen || !tizen.tvwindow || !tizen.systeminfo) { unavailable(done); return; }
    var finish = bounded(done);
    var match = /^HDMI([0-9]+)$/.exec(name), number = match ? parseInt(match[1], 10) : 0;
    if (!number) { finish({ message: 'Unknown source ' + name + '.' }); return; }
    try {
      tizen.systeminfo.getPropertyValue('VIDEOSOURCE', function (info) {
        var all = (info.connected || []).concat(info.disconnected || []), found = null, i;
        for (i = 0; i < all.length; i++) {
          if (all[i].type === 'HDMI' && all[i].number === number) { found = all[i]; break; }
        }
        if (!found) { finish({ message: 'HDMI ' + number + ' is not reported by the TV.' }); return; }
        tizen.tvwindow.setSource(found, function () {
          /* Show the selected source full-screen inside the launcher; Back returns Home. */
          tizen.tvwindow.show(function () { finish(null); }, function (err) { finish(failure(err)); }, ['0px', '0px', '1920px', '1080px'], 'MAIN');
        }, function (err) { finish(failure(err)); }, 'MAIN');
      }, function (err) { finish(failure(err)); });
    } catch (err) { finish(failure(err)); }
  }
  function hideSource(done) {
    if (!window.tizen || !tizen.tvwindow) { unavailable(done); return; }
    var finish = bounded(done);
    try { tizen.tvwindow.hide(function () { finish(null); }, function (err) { finish(failure(err)); }, 'MAIN'); }
    catch (err) { finish(failure(err)); }
  }
  /* Q90T fork: EDID-derived input names from the local EdidService bridge
     (http://127.0.0.1:8787/). Fails gracefully when the service is absent. */
  function sourceNames(done) {
    var finish = bounded(done), xhr;
    try {
      xhr = new XMLHttpRequest();
      xhr.open('GET', 'http://127.0.0.1:8787/', true);
      xhr.timeout = 4000;
      xhr.onload = function () {
        if (xhr.status !== 200) { finish({ message: 'Name service unavailable.' }); return; }
        try { finish(null, JSON.parse(xhr.responseText)); }
        catch (e) { finish({ message: 'Name service returned bad data.' }); }
      };
      xhr.onerror = function () { finish({ message: 'Name service unavailable.' }); };
      xhr.ontimeout = function () { finish({ message: 'Name service unavailable.' }); };
      xhr.send();
    } catch (e) { finish({ message: 'Name service unavailable.' }); }
  }
  function home(done) { launchApp('com.samsung.tv.csfs', done); }
  function settings(done) { launchApp('com.samsung.tv.coba.setting', done); }
  function apps(done) {
    if (!api()) { unavailable(done); return; }
    var finish = bounded(done);
    try {
      api().getAppsInfo(function (list) {
        var known = {}, seen = {}, result = [];
        Object.keys(IDS).forEach(function (brand) { known[IDS[brand]] = brand; });
        list.forEach(function (a) {
          var primary = !!known[a.id], stream = STREAMING.indexOf(a.id) >= 0;
          var consumer = /^[A-Za-z0-9]{10}\.[A-Za-z0-9_-]+$/.test(a.id) || CONSUMER_SYSTEM.indexOf(a.id) >= 0;
          if (a.id === SELF || INTERNAL.indexOf(a.id) >= 0 || seen[a.id] || !a.name || (!primary && !stream && (!a.show || !consumer))) return;
          if (!primary && /(?:service|worker|preview|promotion|plugin|launcher|test|sdk|^ep[ -]|factory|daemon)/i.test(a.name + ' ' + a.id)) return;
          if (/-dummy$/.test(a.id) || a.id === 'com.samsung.tv.cobalt-yt') return;
          seen[a.id] = true;
          result.push({ appId: a.id, name: a.name, brand: known[a.id] || EXTRA_BRANDS[a.id] || '', icon: a.iconPath || '', rank: primary ? Object.keys(IDS).indexOf(known[a.id]) : (stream ? 20 : 30) });
        });
        result.sort(function (a, b) { return a.rank - b.rank || a.name.toLowerCase().localeCompare(b.name.toLowerCase()); });
        finish(null, result);
      }, function (err) { finish(failure(err)); });
    } catch (err) { finish(failure(err)); }
  }
  window.FrameDevice = { launch: launch, launchApp: launchApp, source: source, hideSource: hideSource, sourceNames: sourceNames, home: home, settings: settings, apps: apps };
}());
