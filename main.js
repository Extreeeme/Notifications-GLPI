// Import de la bibliothèque d'Electron
const { app, BrowserWindow, Notification, Menu, ipcMain, net, session } = require ('electron')
// Import de la bibliothèque gérant les sauvegardes de données
const Store = require ('electron-store')
const store = new Store();
// Bibliothèque d'ouverture des pages web dans le navigateur par défaut du user
const open = require('open');
const path = require('path');
// Bibliothèque des logs
const log = require('electron-log');
const assetsPath = app.isPackaged ? path.join(process.resourcesPath, "assets") : "assets";

require('./config.js')
//
// ─── ACCUEIL ────────────────────────────────────────────────────────────────────
//

/**
 * Fonction de création de la fenêtre de démarrage (Rouge sans notif)
 * Elle n'est plus utilisée après
 */
function createWindow () {
    // Propriétés de la fenêtre
    let mainWindow = new BrowserWindow({
        // Largeur
        width: 800,
        // Hauteur
        height: 340,
        // On la centre sur l'écran
        x: 'center',
        y: 'center',
        // Titre de la fenêtre
        title: 'Alertes GLPI',
        // Bordure fenêtre de l'OS
        frame: false,
        backgroundColor: '#FFF',
        resizable: false,
        // Intégration de NodeJS pour lancer des scripts dans le HTML
        webPreferences: {
            nodeIntegration: true
        }
    })
    // Ouvrir la console en dev
    // mainWindow.webContents.openDevTools();
    
    // Suppression du menu Electron
    Menu.setApplicationMenu(null);

    // Ouverture des liens de la documentation dans le navigateur par défaut
    mainWindow.webContents.on('new-window', function(event, url){
        event.preventDefault();
        open(url);
    });
    // Chargement du index.html dans la fenêtre
    mainWindow.loadFile('index.html')

    // Si la fenêtre est fermée on réinitialise la variable
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

}

//
// ─── PAGE COURANTE ──────────────────────────────────────────────────────────────
//


/**
 * Rechargement de la fenêtre avec le indexActive.html actualisé
 */
function activeWindow() {
    BrowserWindow.getAllWindows()[0].loadFile('indexActive.html')
}

/**
 * Chargement de la page d'accueil après avoir désactivé les notifications
 */
function stopNotifWindow() {
    BrowserWindow.getAllWindows()[0].loadFile('index.html')
}

/**
 * Rechargement de la page d'accueil après la connexion à GLPI
 */
function afterConnexion() {
    BrowserWindow.getAllWindows()[1].loadFile('indexActive.html')
}

/**
 * Fenêtre de documentation
 */
function docWindow() {
    var docWindow = new BrowserWindow({
        x: 'center',
        y: 'center',
        width: 1200,
        height: 800,
        frame: false,
        backgroundColor: '#FFF',
        resizable: false,
        // Intégration de NodeJS pour lancer des scripts dans le HTML
        webPreferences: {
            nodeIntegration: true
        },
        title: 'Documentation',
    })

    // Chargement du documentation.html dans la fenêtre
    docWindow.loadFile('documentation.html')
    // docWindow.webContents.openDevTools();

    // Ouverture des liens de la documentation dans le navigateur par défaut
    docWindow.webContents.on('new-window', function(event, url){
        event.preventDefault();
        open(url);
    });
    log.info('Ouverture de la documentation')

    // Si la fenêtre est fermée on réinitialise la variable
    docWindow.on('closed', () => {
        docWindow = null;
    });
}

/**
 * Fenêtre de connexion à GLPI
 */
function errorWindow() {
    var authWindow = new BrowserWindow({
        width: 800, 
        height: 500, 
        resizable: false,
        'node-integration': false,
        'web-security': false
    });
    // This is just an example url - follow the guide for whatever service you are using
    var authUrl = config['URL']+'/front/ticket.php'
    
    authWindow.loadURL(authUrl);
    authWindow.show();
    //did-navigate se déclenche dès qu'une navigation se produit sur la page web de GLPI
    authWindow.webContents.on('did-navigate', function (url, httpResponseCode, httpStatusText) {  
        // Si le serveur répond un code 200 ET sur le lien d'accueil, l'utilisateur est connecté      
        if (httpStatusText == '200' && httpResponseCode == (config['URL']+"/front/central.php")) {
            requestNotif();
            afterConnexion();
            authWindow.close();
        }
        // More complex code to handle tokens goes here
    });
    
    log.info('Authentification GLPI demandée')

    authWindow.on('closed', function() {
        authWindow = null;
    });
}

/**
 * Fonction d'accueil
 */
function requestNotif() {
    // Autorisation du SSO
    session.defaultSession.allowNTLMCredentialsForDomains('*')

    // Initialisation de la variable contenant la page HTML de GLPI complète
    let body = ''

    // Bibliothèque permettant de récupérer des élements précis dans la page HTML récupérée
    const cheerio = require('cheerio');

    // Requête pour récupérer la page
    const request = net.request({
        // Méthode GET (imposée par GLPI)
        method: 'GET',

        // Https
        protocol: 'https:',

        // Lien vers la page contenant la propriété reset (sinon GLPI tente une redirection en JS non
        // supportée par Electron)
        url: config['URL']+'/front/ticket.php?reset=reset',
      })

      // S'il y a une réponse
      request.on('response', (response) => {
        // On chunk la réponse
        response.on('data', (chunk) => {
            // Et on l'insère dans la variable string body
            body += chunk.toString()
        })

        // On ne catch pas les erreurs, pas le temps de niaiser
        response.on('error', (error) => {
          
        })

        // Quand la requête à fini de répondre
        response.on('end', () => {
            // <TEST>
            // Si jamais on souhaite savoir le nombre d'élement reçu
            // let nombreElements = cheerio('td', body).length;
            // </TEST>

            // String contenant les infos des tickets pour les tests
            ticketsGLPI = "";
            // Initialisation 
            bodyHtml = [];

            // Pour les 3 premiers éléments
            for (let i = 0; i < 3; i++) {
                // On récupère les éléments identifiés au préalable sur la page GLPI (User / Titre / Date modif / Lien / ID)
                bodyHtml.push(cheerio('span#myname, form#massformTicket > div > table > tbody > tr > td > a[id^="Ticket"], form#massformTicket > div > table > tbody > tr > td:nth-child(10)', body)[i]);
            }

            // Vérification sur le contenu de la variable
            if (bodyHtml!= "") {
                // On boucle sur chaque élément du tableau
                bodyHtml.forEach(function(item) {
                    // Erreur la plus commune, si rien n'est trouvé sur la page
                    if(typeof item !== 'undefined') {
                            // Puis sur chaque élément de l'élément
                            item.childNodes.forEach(function(item2) {
                                // Si son parent est un lien, c'est le titre du ticket
                                if(item2.parent.name == 'a') {
                                    // Titre du ticket
                                    ticketTitre = item2.data;
                                    // Lien du ticket ('sous le format /front/ticket.php?ID=truc)
                                    ticketLien = config['URL']+item2.parent.attribs.href;
                                    // ID du ticket
                                    ticketID = item2.parent.attribs.id;
                                    // String incrémentée pour les tests
                                    ticketsGLPI = ticketsGLPI+"Titre: "+item2.data+"\n"+"Lien: "+config['URL']+item2.parent.attribs.href+"\n"+'ID: '+item2.parent.attribs.id+"\n";
                                } else if(item2.parent.attribs.id == "myname") {
                                    // Si l'ID de l'élément parent est myname, il s'agit de l'identitié de l'agent connecté
                                    user = item2.data;
                                    // String incrémentée pour les tests
                                    ticketsGLPI = ticketsGLPI+"User: "+item2.data+"\n";
                                } else {
                                    // Sinon il s'agit de la date de modif
                                    // Date de modif du ticket (création ou suivi)
                                    ticketDate = item2.data
                                    // String incrémentée pour les tests
                                    ticketsGLPI = ticketsGLPI+"Date: "+item2.data+"\n";
                                }
                            })
                    }
                });
            }

            // Si la page GLPI s'est chargée correctement
            if (typeof ticketLien !== 'undefined') {
                // On sauvegarde les informations du ticket dans le store
                // Store actuel
                store.set('ticketLien', ticketLien);
                sleep(500);
                store.set('ticketTitre', ticketTitre);
                sleep(500);
                store.set('ticketDate', ticketDate);
                sleep(500);
                store.set('ticketID', ticketID);
                sleep(500);
                store.set('user', user);
    
                // Store de comparaison (sans le user)
                sleep(500);
                store.set('ticketTitreBase', ticketTitre);
                sleep(500);
                store.set('ticketLienBase', ticketLien);
                sleep(500);
                store.set('ticketDateBase', ticketDate);
                sleep(500);
                store.set('ticketIDBase', ticketID);
                // On retire l'ID du ticket (qui était sous la forme ticket60005)
                id = ticketID.split('Ticket');
                id = numStr(id[1]);
    
                // On créé la notif de lancement de l'application pour vérifier que tout va bien
    
                // Import des bibliothèques nécéssaires à la notification
                const notifier = require('node-notifier');
                
                log.info('Application démarrée')
                // Notification
                notifier.notify({
                    // Nom de la notif TRES IMPORTANT, WINDOWS AUTORISE CETTE APPLICATION CAR IL CONNAIT LE NOM
                    // APRES INSTALLATION
                    appName: 'com.AlertesGLPI.desktop-notifications',
                    // Entête de la notification
                    title: "DERNIER TICKET : " + ticketTitre,
                    // Message sous l'entête
                    message: `Numéro du ticket : `+ id,
                    // Icone de la notification
                    icon: path.join(assetsPath, 'icon.png'),
                    // Pas de son
                    sound: false,
                    // Est censé rester, ne fonctionne apparemment pas
                    wait: true,
    
                    // S'il y a une erreur, on affiche dans la console
                }, (err) => {
                    if (err) {
                    console.error('Snoretoast error: ', err);
                    }
                });
                
                // Au clique, ouvrir le lien dy ticket
                notifier.on('click', function(notifierObject, options, event) {
                    open(ticketLien);// Triggers if `wait: true` and user clicks notification
                });
            } else {
                // 'S'il y a un problème sur la page GLPI
                // Import des bibliothèques nécéssaires à la notification
                const notifier = require('node-notifier');
    
                // Notification
                notifier.notify({
                    // Nom de la notif TRES IMPORTANT, WINDOWS AUTORISE CETTE APPLICATION CAR IL CONNAIT LE NOM
                    // APRES INSTALLATION
                    appName: 'com.AlertesGLPI.desktop-notifications',
                    // Entête de la notification
                    title: "Vous n'êtes pas connecté à GLPI !",
                    // Message sous l'entête
                    message: `Veuillez vous connecter dans la fenêtre actuelle`,
                    // Icone de la notification
                    icon: path.join(assetsPath, 'icon.png'),
                    // Pas de son
                    sound: false,
                    // Est censé rester, ne fonctionne apparemment pas
                    wait: true,
    
                    // S'il y a une erreur, on affiche dans la console
                }, (err) => {
                    if (err) {
                    console.error('Snoretoast error: ', err);
                    }
                });
            }

        })
    })
    // On termine la requête TRES IMPORTANT
    request.end()
}

/**
 * 
 * @param {*} a 
 * @param {*} b Optionnel
 * Converti un nombre XXXX en X XXX (séparateur de milliers) 
 */
function numStr(a, b) {
    a = '' + a;
    b = b || ' ';
    var c = '',
        d = 0;
    while (a.match(/^0[0-9]/)) {
        a = a.substr(1);
    }
    for (var i = a.length-1; i >= 0; i--) {
        c = (d != 0 && d % 3 == 0) ? a[i] + b + c : a[i] + c;
        d++;
    }
    return c;
}

/**
 * Function vérifiant si de nouveaux tickets sont présent
 */
function requestNotifVERIF() {
    // Initialisation de la variable contenant la page HTML de GLPI complète
    let body = ''

    // Bibliothèque permettant de récupérer des élements précis dans la page HTML récupérée
    const cheerio = require('cheerio');

    // Requête pour récupérer la page
    const request = net.request({
        // Méthode GET (imposée par GLPI)
        method: 'GET',

        // Https
        protocol: 'https:',

        // Lien vers la page contenant la propriété reset (sinon GLPI tente une redirection en JS non
        // supportée par Electron)
        url: config['URL']+'/front/ticket.php?reset=reset',
      })

      // S'il y a une réponse
      request.on('response', (response) => {
        // On chunk la réponse
        response.on('data', (chunk) => {
            // Et on l'insère dans la variable string body
            body += chunk.toString()
        })

        // On ne catch pas les erreurs, pas le temps de niaiser
        response.on('error', (error) => {
          
        })

        // Quand la requête à fini de répondre
        response.on('end', () => {
            // <TEST>
            // Si jamais on souhaite savoir le nombre d'élement reçu
            // let nombreElements = cheerio('td', body).length;
            // </TEST>

            // String contenant les infos des tickets pour les tests
            ticketsGLPI = "";

            // Initialisation 
            bodyHtml = [];

            // Pour les 3 premiers éléments
            for (let i = 0; i < 3; i++) {
                // On récupère les éléments identifiés au préalable sur la page GLPI (User / Titre / Date modif / Lien / ID)
                bodyHtml.push(cheerio('span#myname, form#massformTicket > div > table > tbody > tr > td > a[id^="Ticket"], form#massformTicket > div > table > tbody > tr > td:nth-child(10)', body)[i]);
            }

            // On boucle sur chaque élément du tableau
            bodyHtml.forEach(function(item) {
                // Puis sur chaque élément de l'élément
                item.childNodes.forEach(function(item2) {
                    // Si son parent est un lien, c'est le titre du ticket
                    if (item2.parent.name == 'a') {
                        // Titre du ticket
                        ticketTitre = item2.data;
                        // Lien du ticket ('sous le format /front/ticket.php?ID=truc)
                        ticketLien = config['URL']+item2.parent.attribs.href;
                        // ID du ticket
                        ticketID = item2.parent.attribs.id;
                        // String incrémentée pour les tests
                        ticketsGLPI = ticketsGLPI+"Titre: "+item2.data+"\n"+"Lien: "+config['URL']+item2.parent.attribs.href+"\n"+'ID: '+item2.parent.attribs.id+"\n";
                    } else if(item2.parent.attribs.id == "myname") {
                        // Si l'ID de l'élément parent est myname, il s'agit de l'identitié de l'agent connecté
                        user = item2.data;
                        // String incrémentée pour les tests
                        ticketsGLPI = ticketsGLPI+"User: "+item2.data+"\n";
                    } else {
                        // Sinon il s'agit de la date de modif
                        // Date de modif du ticket (création ou suivi)
                        ticketDate = item2.data
                        // String incrémentée pour les tests
                        ticketsGLPI = ticketsGLPI+"Date: "+item2.data+"\n";
                    }
                })
            });

            // On sauvegarde les informations du ticket dans le store
            // Store actuel
            store.set('ticketTitre', ticketTitre);
            sleep(500);
            store.set('ticketLien', ticketLien);
            sleep(500);
            store.set('ticketDate', ticketDate);
            sleep(500);
            store.set('ticketID', ticketID);
            sleep(500);
            store.set('user', user);
        })
    })

    // On termine la requête TRES IMPORTANT
    request.end()
}

/**
 * Fonction appelée depuis le fichier HTML, permet d'activer les notifications
 */
ipcMain.on('request', function(e) {
    // Active les notifications
    requestNotif();
    setTimeout( function() {
                if (typeof store.get('ticketLien') !== 'undefined') {
                    // Recharge le HTML de la page
                    activeWindow();
                } else {
                    errorWindow();
                }
            }, 1000);
    // Si tout s'est bien passé, on charge la page confirmant le fonctionnement de l'application
   
})

/**
 * Désactivation des notifications
 */
ipcMain.on('stop-notif', function(e) {
    stopNotifWindow();
})

ipcMain.on('problem', function(e) {
    docWindow();
})

/**
 * Fonction appelée depuis le fichier HTML, permet de lancer la vérification des tickets
 */
ipcMain.on('notifs', function(e) {
    // Vérification des nouveaux tickets et intégration dans le store
    requestNotifVERIF();

    // Récupération des informations du ticket récupérées dans le store
    ticketTitre = store.get('ticketTitre');
    sleep(500);
    ticketLien = store.get('ticketLien');
    sleep(500);
    ticketDate= store.get('ticketDate');
    sleep(500);
    ticketID = store.get('ticketID');

    // Récupération des informations de la dernière notification affichée
    sleep(500);
    OLDticketTitre = store.get('ticketTitreBase');
    sleep(500);
    OLDticketLien = store.get('ticketLienBase');
    sleep(500);
    OLDticketDate= store.get('ticketDateBase');
    sleep(500);
    OLDticketID = store.get('ticketIDBase');

    // Comparaison des deux, s'ils sont différents on écrase les OLD et on affiche la notification
    if (OLDticketDate != ticketDate) {
        // console.log("NOUVEAU TICKET");
        
        // Écrase les variables OLD
        sleep(500);
        store.set('ticketTitreBase', ticketTitre);
        sleep(500);
        store.set('ticketLienBase', ticketLien);
        sleep(500);
        store.set('ticketDateBase', ticketDate);
        sleep(500);
        store.set('ticketIDBase', ticketID);

        // console.log(ticketTitre)
        // console.log(ticketLien)
        // console.log(ticketDate)
        // console.log(ticketID)

        // On retire l'ID du ticket (qui était sous la forme ticket60005)
        id = ticketID.split('Ticket');
        id = numStr(id[1]);

        // Notification
        const notifier = require('node-notifier');
        var open = require('open');
        notifier.notify({
            // Nom de la notif TRES IMPORTANT, WINDOWS AUTORISE CETTE APPLICATION CAR IL CONNAIT LE NOM
            // APRES INSTALLATION
            appName: 'com.AlertesGLPI.desktop-notifications',
            // Entête de la notification
            title: "NOUVEAU TICKET : " + ticketTitre,
            // Message sous l'entête
            message: `Numéro du ticket : `+ id,
            // Icone de la notification
            icon: path.join(assetsPath, 'icon.png'),
            // Pas de son
            sound: false,
            // Est censé rester, ne fonctionne apparemment pas
            wait: true,

            // S'il y a une erreur, on affiche dans la console
        }, (err) => {
            if (err) {
            console.error('Snoretoast error: ', err);
            }
        });

        // Au clique, ouvrir le lien dy ticket
        notifier.on('click', function(notifierObject, options, event) {
            open(ticketLien);// Triggers if `wait: true` and user clicks notification
        });

        // On recharge le HTML de la fenêtre
        activeWindow();
    }
})
//
// ─── APPLICATION BASIQUE ────────────────────────────────────────────────────────
//

/**
 * Démarrage de l'application
 */
app.whenReady().then(createWindow)
app.on('ready', () => {
    // Si c'est un Windows
    if (process.platform === 'win32') {
        app.setAppUserModelId("com.AlertesGLPI.desktop-notifications");
    }
})
    
// Permet de stopper les processus à la fermeture de la fenêtre
app.on('window-all-closed', () => {
    // Clear du cache
    sleep(500);
    store.delete('ticketLien');
    sleep(500);
    store.delete('ticketTitre');
    sleep(500);
    store.delete('ticketDate');
    sleep(500);
    store.delete('ticketID');
    sleep(500);
    store.delete('user');
    session.defaultSession.clearStorageData();
    // Clear des sessions
    const win = BrowserWindow.getAllWindows()[0];
    const ses = win.webContents.session;

    ses.clearCache(() => {

    });

    // Test pour MacOSX
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

// Si l'application est appelée, on lance la fonction si la fenêtre n'existe pas encore
app.on('activate', () => {
    if (mainWindow === null) {
        createWindow()
    }
})

/**
 * Fonction sleep
 */
function sleep(milliseconds) {
    const date = Date.now();
    let currentDate = null;
    do {
      currentDate = Date.now();
    } while (currentDate - date < milliseconds);
  }