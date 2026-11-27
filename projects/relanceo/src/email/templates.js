// E-mails transactionnels (compte, sécurité, équipe). Envoyés uniquement si un prestataire est configuré.
// En cas d'échec, l'action principale n'est pas annulée : le résultat indique si l'e-mail est parti.
const FOOTER = '\n\n—\nRELANCEO\nCet e-mail est envoyé automatiquement, merci de ne pas y répondre.';

const TEMPLATES = {
  lead: ({ name, company, email, phone, message }) => ({
    subject: `Nouvelle demande de démo : ${company || name}`,
    text: `Nom : ${name}\nEntreprise : ${company ?? '—'}\nE-mail : ${email}\nTéléphone : ${phone ?? '—'}\n\n${message ?? ''}`,
  }),
  welcome: ({ name, company, appUrl }) => ({
    subject: 'Bienvenue sur RELANCEO',
    text: `Bonjour${name ? ` ${name}` : ''},\n\nVotre espace « ${company} » est créé. Choisissez votre offre pour commencer : ${appUrl}/app.html#/abonnement${FOOTER}`,
  }),
  password_reset: ({ link }) => ({
    subject: 'Réinitialisation de votre mot de passe RELANCEO',
    text: `Bonjour,\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.${FOOTER}`,
  }),
  invitation: ({ company, inviter, link }) => ({
    subject: `Invitation à rejoindre ${company} sur RELANCEO`,
    text: `Bonjour,\n\n${inviter ?? 'Un administrateur'} vous invite à rejoindre l'espace « ${company} » sur RELANCEO.\nAccepter l'invitation (valable 7 jours) : ${link}${FOOTER}`,
  }),
};

export async function sendTransactional(services, kind, data) {
  const email = services?.email;
  if (!email?.configured) return { sent: false, reason: 'email_provider_not_configured' };
  const { subject, text } = TEMPLATES[kind](data);
  try {
    const r = await email.send({ to: data.to, subject, text, idempotencyKey: `${kind}:${data.to}:${Date.now()}` });
    return { sent: true, id: r.id };
  } catch (err) {
    console.error(`[email] ${kind} non envoyé : ${err.message}`);
    return { sent: false, reason: 'send_failed' };
  }
}
