// Reemplazo estático del backend Spring Boot.
// Lee los CSV de /public/data y calcula el modelo A(t) = M - (M - A0)·e^(-k·t) en el navegador.

const M = 100.0
const BASE = import.meta.env.BASE_URL

function parsearCSV(texto) {
  const filas = []
  let fila = []
  let campo = ''
  let entreComillas = false
  const t = texto.replace(/^﻿/, '')

  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (entreComillas) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') entreComillas = false
      else campo += c
    } else if (c === '"') entreComillas = true
    else if (c === ',') { fila.push(campo); campo = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      fila.push(campo); campo = ''
      if (fila.some((v) => v !== '')) filas.push(fila)
      fila = []
    } else campo += c
  }
  if (campo !== '' || fila.length) {
    fila.push(campo)
    if (fila.some((v) => v !== '')) filas.push(fila)
  }

  const [cabecera, ...datos] = filas
  return datos.map((f) =>
    Object.fromEntries(cabecera.map((h, i) => [h, f[i] ?? '']))
  )
}

const num = (v) => (v === '' || v == null ? null : Number(v))

let cache = null

async function cargarDatos() {
  if (cache) return cache
  cache = (async () => {
    const [txtEst, txtEva] = await Promise.all([
      fetch(`${BASE}data/estudiantes.csv`).then((r) => {
        if (!r.ok) throw new Error('No se pudo leer estudiantes.csv')
        return r.text()
      }),
      fetch(`${BASE}data/evaluaciones.csv`).then((r) => {
        if (!r.ok) throw new Error('No se pudo leer evaluaciones.csv')
        return r.text()
      }),
    ])

    const estudiantes = parsearCSV(txtEst).map((f) => ({
      id: num(f.id),
      nombre: f.nombre,
      codigo: f.codigo,
    }))

    const evaluaciones = parsearCSV(txtEva)
      .map((f) => ({
        id: num(f.id),
        estudianteId: num(f.estudiante_id),
        tiempoDias: num(f.tiempo_dias),
        fecha: f.fecha || null,
        totalPreguntas: num(f.total_preguntas),
        respuestasCorrectas: num(f.respuestas_correctas),
        porcentaje: num(f.porcentaje),
      }))
      .sort((a, b) => a.id - b.id)

    return { estudiantes, evaluaciones }
  })()
  cache.catch(() => { cache = null })
  return cache
}

function evaluacionesDe(evaluaciones, estudianteId) {
  return evaluaciones.filter((e) => e.estudianteId === estudianteId)
}

function calcularKOptimo(evals) {
  if (!evals.length) return -1
  const inicial = evals.find((e) => e.tiempoDias === 0 && e.porcentaje !== null)
  if (!inicial) return -1
  const A0 = inicial.porcentaje

  const validos = evals.filter((e) => e.tiempoDias > 0 && e.porcentaje !== null)
  if (!validos.length) return -1

  let mejorK = 0
  let menorError = Number.MAX_VALUE
  const paso = 0.0001
  const limite = 5.0

  for (let k = 0.0; k <= limite; k += paso) {
    let error = 0
    for (const e of validos) {
      const d = e.porcentaje - (M - (M - A0) * Math.exp(-k * e.tiempoDias))
      error += d * d
    }
    if (error < menorError) {
      menorError = error
      mejorK = k
    }
  }
  return mejorK
}

export async function obtenerEstudiantes() {
  return (await cargarDatos()).estudiantes
}

export async function obtenerEvaluacionesPorEstudiante(id) {
  const { evaluaciones } = await cargarDatos()
  return evaluacionesDe(evaluaciones, id)
}

export async function obtenerK(id) {
  const { evaluaciones } = await cargarDatos()
  return calcularKOptimo(evaluacionesDe(evaluaciones, id))
}

export async function obtenerDatosModelo(id) {
  const { evaluaciones } = await cargarDatos()
  const evals = evaluacionesDe(evaluaciones, id)
  const inicial = evals.find((e) => e.tiempoDias === 0 && e.porcentaje !== null)
  if (!inicial) return []
  const k = calcularKOptimo(evals)
  if (k < 0) return []

  const A0 = inicial.porcentaje
  return evals
    .filter((e) => e.tiempoDias !== null && e.porcentaje !== null)
    .sort((a, b) => a.tiempoDias - b.tiempoDias)
    .map((e) => ({
      tiempoDias: e.tiempoDias,
      porcentajeReal: e.porcentaje,
      porcentajeModelo: M - (M - A0) * Math.exp(-k * e.tiempoDias),
    }))
}

export async function obtenerResumen() {
  const { estudiantes, evaluaciones } = await cargarDatos()
  const resultado = []

  for (const est of estudiantes) {
    const evals = evaluacionesDe(evaluaciones, est.id)
    const inicial = evals.find((e) => e.tiempoDias === 0 && e.porcentaje !== null)
    if (!inicial) continue

    const A0 = inicial.porcentaje
    const k = calcularKOptimo(evals)
    if (k < 0) continue

    const validos = evals
      .filter((e) => e.tiempoDias !== null && e.porcentaje !== null)
      .sort((a, b) => a.tiempoDias - b.tiempoDias)
    if (!validos.length) continue

    let sumaAbs = 0
    let sumaCuad = 0
    let sumaReal = 0
    for (const e of validos) {
      const err = e.porcentaje - (M - (M - A0) * Math.exp(-k * e.tiempoDias))
      sumaAbs += Math.abs(err)
      sumaCuad += err * err
      sumaReal += e.porcentaje
    }

    const n = validos.length
    const promedioReal = sumaReal / n
    const sumaTotal = validos.reduce((s, e) => s + (e.porcentaje - promedioReal) ** 2, 0)
    const errorPromedio = sumaAbs / n
    const rmse = Math.sqrt(sumaCuad / n)
    const r2 = sumaTotal === 0 ? 1.0 : 1.0 - sumaCuad / sumaTotal

    for (const e of validos) {
      const modelo = M - (M - A0) * Math.exp(-k * e.tiempoDias)
      resultado.push({
        estudianteId: est.id,
        codigo: est.codigo,
        nombre: est.nombre,
        A0,
        k,
        tiempoDias: e.tiempoDias,
        porcentajeReal: e.porcentaje,
        porcentajeModelo: modelo,
        errorAbsoluto: Math.abs(e.porcentaje - modelo),
        errorCuadratico: (e.porcentaje - modelo) ** 2,
        errorPromedio,
        rmse,
        r2,
      })
    }
  }
  return resultado
}
