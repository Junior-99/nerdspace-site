# Security reporting

Report a suspected NerdSpace vulnerability privately to mtheophilus565@gmail.com. Include affected page/app version, reproducible steps and impact. Do not send passwords, private keys, payment-card details, other people's private messages or exploit uploads. Do not test against other users or disrupt the live service.

The Firebase client API key in assets/plus.js is intentionally public project configuration. It is restricted to Firebase runtime APIs; it is not a database password, payment secret or administrator credential. Access requires Firebase Authentication and server authorization/Security Rules. Payment secrets and webhook authentication remain in Google Secret Manager and are never included in this website.

The static site runs no server package installation and uses the official, versioned Firebase browser SDK. The app repository runs dependency and credential checks separately. Please report a private credential exposure immediately instead of posting the value in a public issue.
