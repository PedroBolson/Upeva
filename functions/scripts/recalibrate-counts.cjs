/**
 * Recalibra metadata/counts diretamente via Admin SDK.
 * Uso: node functions/scripts/recalibrate-counts.cjs
 * Requer: gcloud auth application-default login (já feito se você usa Firebase CLI)
 */

const { initializeApp, cert, applicationDefault } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')

initializeApp({ credential: applicationDefault(), projectId: 'upevapets' })
const db = getFirestore()

async function run() {
  const animalStatuses = ['available', 'under_review', 'adopted', 'archived']
  const appStatuses = ['pending', 'in_review', 'approved', 'rejected', 'withdrawn']

  const [animalTotalSnap, ...animalStatusSnaps] = await Promise.all([
    db.collection('animals').count().get(),
    ...animalStatuses.map((s) => db.collection('animals').where('status', '==', s).count().get()),
  ])
  const [appTotalSnap, ...appStatusSnaps] = await Promise.all([
    db.collection('applications').count().get(),
    ...appStatuses.map((s) => db.collection('applications').where('status', '==', s).count().get()),
  ])

  const animals = { total: animalTotalSnap.data().count }
  animalStatuses.forEach((s, i) => { animals[s] = animalStatusSnaps[i].data().count })

  const applications = { total: appTotalSnap.data().count }
  appStatuses.forEach((s, i) => { applications[s] = appStatusSnaps[i].data().count })

  await db.collection('metadata').doc('counts').set({ animals, applications })

  console.log('Contadores atualizados:')
  console.log('Animais:', animals)
  console.log('Candidaturas:', applications)
}

run().catch((err) => { console.error(err); process.exit(1) })
