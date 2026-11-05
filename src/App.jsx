import { useEffect, useState } from 'react'
import {
  obtenerEstudiantes,
  obtenerEvaluacionesPorEstudiante,
  obtenerK,
  obtenerDatosModelo,
  obtenerResumen,
} from './api'
import './App.css'

function App() {
  const [vista, setVista] = useState('inicio')
  const [estudiantes, setEstudiantes] = useState([])
  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState(null)
  const [evaluaciones, setEvaluaciones] = useState([])
  const [datosModelo, setDatosModelo] = useState([])
  const [k, setK] = useState(null)
  const [resumen, setResumen] = useState([])
  const [diaPrediccion, setDiaPrediccion] = useState(10)
  const [cargandoResumen, setCargandoResumen] = useState(false)
  const [errorResumen, setErrorResumen] = useState('')
  const [cargando, setCargando] = useState(false)
  const [cargandoEvaluaciones, setCargandoEvaluaciones] = useState(false)
  const [cargandoAnalisis, setCargandoAnalisis] = useState(false)
  const [error, setError] = useState('')
  const [errorEvaluaciones, setErrorEvaluaciones] = useState('')
  const [errorAnalisis, setErrorAnalisis] = useState('')

  useEffect(() => {
    if (vista !== 'estudiantes') return
    setCargando(true)
    setError('')

    obtenerEstudiantes()
      .then((datos) => setEstudiantes(datos))
      .catch(() => setError('No se pudieron cargar los datos de los estudiantes.'))
      .finally(() => setCargando(false))
  }, [vista])

  useEffect(() => {
    if (!estudianteSeleccionado) return

    setCargandoEvaluaciones(true)
    setCargandoAnalisis(true)
    setErrorEvaluaciones('')
    setErrorAnalisis('')
    setEvaluaciones([])
    setDatosModelo([])
    setK(null)

    const id = estudianteSeleccionado.id

    Promise.all([
      obtenerEvaluacionesPorEstudiante(id),
      obtenerK(id),
      obtenerDatosModelo(id)
    ])
      .then(([respuestaEvaluaciones, respuestaK, respuestaModelo]) => {
        setEvaluaciones(respuestaEvaluaciones)
        setK(respuestaK)
        setDatosModelo(respuestaModelo)
      })
      .catch(() => {
        setErrorEvaluaciones('No se pudieron cargar las evaluaciones del estudiante.')
        setErrorAnalisis('No se pudo cargar el análisis matemático.')
      })
      .finally(() => {
        setCargandoEvaluaciones(false)
        setCargandoAnalisis(false)
      })
  }, [estudianteSeleccionado])

  useEffect(() => {
    if (vista !== 'evaluaciones') return
    setCargandoResumen(true)
    setErrorResumen('')

    obtenerResumen()
      .then((datos) => setResumen(datos))
      .catch(() => setErrorResumen('No se pudo cargar el análisis general del experimento.'))
      .finally(() => setCargandoResumen(false))
  }, [vista])

  const seleccionarEstudiante = (estudiante) => {
    setEstudianteSeleccionado(estudiante)
    setDiaPrediccion(10)
  }

  const volverEstudiantes = () => {
    setEstudianteSeleccionado(null)
    setEvaluaciones([])
    setDatosModelo([])
    setK(null)
  }

  const evaluacionInicial = evaluaciones.find(
    (evaluacion) => evaluacion.tiempoDias === 0
  )

  const porcentajeInicial = evaluacionInicial?.porcentaje ?? null

  const datosValidosModelo = datosModelo.filter(
    (dato) =>
      dato.tiempoDias !== null &&
      dato.porcentajeReal !== null &&
      dato.porcentajeModelo !== null
  )

  const errorPromedioIndividual = datosValidosModelo.length
    ? datosValidosModelo.reduce(
        (suma, dato) => suma + Math.abs(dato.porcentajeReal - dato.porcentajeModelo),
        0
      ) / datosValidosModelo.length
    : 0

  const rmseIndividual = datosValidosModelo.length
    ? Math.sqrt(
        datosValidosModelo.reduce((suma, dato) => {
          const error = dato.porcentajeReal - dato.porcentajeModelo
          return suma + error * error
        }, 0) / datosValidosModelo.length
      )
    : 0

  const promedioRealIndividual = datosValidosModelo.length
    ? datosValidosModelo.reduce(
        (suma, dato) => suma + dato.porcentajeReal,
        0
      ) / datosValidosModelo.length
    : 0

  const sumaTotalIndividual = datosValidosModelo.reduce((suma, dato) => {
    const diferencia = dato.porcentajeReal - promedioRealIndividual
    return suma + diferencia * diferencia
  }, 0)

  const sumaErrorIndividual = datosValidosModelo.reduce((suma, dato) => {
    const diferencia = dato.porcentajeReal - dato.porcentajeModelo
    return suma + diferencia * diferencia
  }, 0)

  const r2Individual =
    sumaTotalIndividual === 0
      ? 1
      : 1 - sumaErrorIndividual / sumaTotalIndividual

  const interpretacionErrorIndividual =
    datosValidosModelo.length < 2
      ? 'Hay pocos datos para valorar de forma confiable el ajuste del modelo.'
      : errorPromedioIndividual <= 5
        ? 'El modelo presenta una diferencia promedio pequeña frente a los resultados registrados.'
        : errorPromedioIndividual <= 10
          ? 'El modelo presenta diferencias moderadas frente a los resultados registrados.'
          : 'El modelo presenta diferencias importantes frente a los resultados registrados.'

  const interpretacionR2Individual =
    datosValidosModelo.length < 2
      ? 'Se necesitan al menos dos observaciones para interpretar el ajuste con mayor fundamento.'
      : sumaTotalIndividual === 0
        ? 'Los resultados reales no muestran variación; por eso R² no permite evaluar adecuadamente el ajuste en este caso.'
        : r2Individual < 0
          ? 'El modelo se ajusta peor que usar el promedio de los resultados reales como referencia.'
          : r2Individual >= 0.8
            ? 'R² indica un ajuste alto para estos datos, aunque no garantiza predicciones futuras.'
            : r2Individual >= 0.5
              ? 'R² indica un ajuste intermedio; conviene revisar las diferencias entre los datos.'
              : 'R² indica un ajuste limitado para estos datos.'

  const interpretacionKIndividual =
    k === null
      ? 'No hay un valor de k disponible para interpretar.'
      : Number(k) > 0
        ? `La constante k = ${Number(k).toFixed(4)} representa la rapidez estimada con la que el modelo se aproxima al nivel máximo definido.`
        : 'El valor de k no es positivo, por lo que el modelo no representa un crecimiento estimado en este caso.'

  const clasificarDiferencia = (diferencia) => {
    if (diferencia <= 5) {
      return {
        texto: 'Pequeña',
        color: '#166534',
        fondo: '#dcfce7',
        descripcion: 'Hasta 5 puntos porcentuales'
      }
    }

    if (diferencia <= 10) {
      return {
        texto: 'Moderada',
        color: '#92400e',
        fondo: '#fef3c7',
        descripcion: 'Más de 5 y hasta 10 puntos porcentuales'
      }
    }

    return {
      texto: 'Alta',
      color: '#991b1b',
      fondo: '#fee2e2',
      descripcion: 'Más de 10 puntos porcentuales'
    }
  }

  const prediccionIndividual =
    porcentajeInicial !== null &&
    k !== null &&
    Number.isFinite(Number(diaPrediccion)) &&
    Number(diaPrediccion) >= 0
      ? 100 - (100 - porcentajeInicial) * Math.exp(-k * Number(diaPrediccion))
      : null

  const crearCoordenadas = (campo) => {
    if (!datosModelo.length) return []

    const ancho = 760
    const alto = 320
    const margenIzquierdo = 55
    const margenDerecho = 25
    const margenSuperior = 25
    const margenInferior = 45
    const anchoUtil = ancho - margenIzquierdo - margenDerecho
    const altoUtil = alto - margenSuperior - margenInferior
    const maxX = Math.max(...datosModelo.map((dato) => dato.tiempoDias))

    if (maxX === 0) return []

    return datosModelo.map((dato) => ({
      x: margenIzquierdo + (dato.tiempoDias / maxX) * anchoUtil,
      y: margenSuperior + ((100 - dato[campo]) / 100) * altoUtil,
      dia: dato.tiempoDias,
      valor: dato[campo]
    }))
  }

  const crearPuntosGrafica = (campo) =>
    crearCoordenadas(campo)
      .map((punto) => `${punto.x},${punto.y}`)
      .join(' ')

  const puntosReales = crearCoordenadas('porcentajeReal')
  const puntosModelo = crearCoordenadas('porcentajeModelo')

  const estudiantesResumen = [
    ...new Map(
      resumen.map((dato) => [
        dato.estudianteId,
        {
          id: dato.estudianteId,
          codigo: dato.codigo,
          nombre: dato.nombre
        }
      ])
    ).values()
  ]

  const diasResumen = [
    ...new Set(
      resumen
        .map((dato) => dato.tiempoDias)
        .filter((dia) => dia !== null)
    )
  ].sort((a, b) => a - b)

  const promediosPorDia = diasResumen.map((dia) => {
    const datos = resumen.filter((dato) => dato.tiempoDias === dia)

    const promedioReal = datos.length
      ? datos.reduce((suma, dato) => suma + dato.porcentajeReal, 0) / datos.length
      : 0

    const promedioModelo = datos.length
      ? datos.reduce((suma, dato) => suma + dato.porcentajeModelo, 0) / datos.length
      : 0

    return { dia, promedioReal, promedioModelo }
  })

  const promedioInicialGeneral =
    promediosPorDia.find((dato) => dato.dia === 0)?.promedioReal ?? 0

  const ultimoDiaGeneral = promediosPorDia.length
    ? promediosPorDia[promediosPorDia.length - 1].dia
    : null

  const promedioFinalGeneral =
    ultimoDiaGeneral !== null
      ? promediosPorDia.find((dato) => dato.dia === ultimoDiaGeneral)?.promedioReal ?? 0
      : 0

  const promedioKGeneral = estudiantesResumen.length
    ? estudiantesResumen.reduce((suma, estudiante) => {
        const datos = resumen.filter((dato) => dato.estudianteId === estudiante.id)
        return suma + (datos.length ? datos[0].k : 0)
      }, 0) / estudiantesResumen.length
    : 0

  const promedioErrorGeneral = estudiantesResumen.length
    ? estudiantesResumen.reduce((suma, estudiante) => {
        const datos = resumen.filter((dato) => dato.estudianteId === estudiante.id)
        return suma + (datos.length ? datos[0].errorPromedio ?? 0 : 0)
      }, 0) / estudiantesResumen.length
    : 0

  const promedioRMSEGeneral = estudiantesResumen.length
    ? estudiantesResumen.reduce((suma, estudiante) => {
        const datos = resumen.filter((dato) => dato.estudianteId === estudiante.id)
        return suma + (datos.length ? datos[0].rmse ?? 0 : 0)
      }, 0) / estudiantesResumen.length
    : 0

  const promedioR2General = estudiantesResumen.length
    ? estudiantesResumen.reduce((suma, estudiante) => {
        const datos = resumen.filter((dato) => dato.estudianteId === estudiante.id)
        return suma + (datos.length ? datos[0].r2 ?? 0 : 0)
      }, 0) / estudiantesResumen.length
    : 0

  const datosFinales = estudiantesResumen.map((estudiante) => {
    const datos = resumen.filter((dato) => dato.estudianteId === estudiante.id)
    const inicial = datos.find((dato) => dato.tiempoDias === 0)
    const datosOrdenados = [...datos].sort((a, b) => a.tiempoDias - b.tiempoDias)
    const final = datosOrdenados[datosOrdenados.length - 1]

    return {
      ...estudiante,
      A0: inicial?.porcentajeReal ?? 0,
      final: final?.porcentajeReal ?? 0,
      k: datos[0]?.k ?? 0,
      errorPromedio: datos[0]?.errorPromedio ?? 0,
      rmse: datos[0]?.rmse ?? 0,
      r2: datos[0]?.r2 ?? 0
    }
  })

  const diasPrediccionGrupal = [8, 9, 10, 15, 20]

  const prediccionesGrupales = diasPrediccionGrupal.map((dia) => {
    const predicciones = datosFinales
      .filter((estudiante) => estudiante.A0 !== null && estudiante.k !== null)
      .map(
        (estudiante) =>
          100 -
          (100 - estudiante.A0) * Math.exp(-estudiante.k * dia)
      )

    const promedio = predicciones.length
      ? predicciones.reduce((suma, valor) => suma + valor, 0) / predicciones.length
      : 0

    return {
      dia,
      promedio,
      cantidadEstudiantes: predicciones.length
    }
  })

  const crearCoordenadasResumen = (campo) => {
    if (!promediosPorDia.length) return []

    const margenIzquierdo = 55
    const anchoUtil = 680
    const maxX = Math.max(...promediosPorDia.map((dato) => dato.dia))

    if (maxX === 0) return []

    return promediosPorDia.map((dato) => ({
      x: margenIzquierdo + (dato.dia / maxX) * anchoUtil,
      y: 25 + ((100 - dato[campo]) / 100) * 250,
      dia: dato.dia,
      valor: dato[campo]
    }))
  }

  const crearPuntosResumen = (campo) =>
    crearCoordenadasResumen(campo)
      .map((punto) => `${punto.x},${punto.y}`)
      .join(' ')

  const puntosRealesResumen = crearCoordenadasResumen('promedioReal')
  const puntosModeloResumen = crearCoordenadasResumen('promedioModelo')

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="brand">
            <div className="brand-icon">🧠</div>
            <div>
              <h1>Modelo de Aprendizaje</h1>
              <span>Dinámica del aprendizaje mediante EDO</span>
            </div>
          </div>

          <nav className="nav">
            {[
              ['inicio', 'Inicio'],
              ['estudiantes', 'Estudiantes'],
              ['evaluaciones', 'Evaluaciones'],
              ['modelo', 'Modelo EDO']
            ].map(([id, nombre]) => (
              <button
                key={id}
                className={vista === id ? 'nav-button active' : 'nav-button'}
                onClick={() => {
                  setVista(id)
                  if (id === 'inicio') setEstudianteSeleccionado(null)
                }}
              >
                {nombre}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="main">
        {vista === 'inicio' && (
          <>
            <section className="hero-section">
              <div className="hero-content">
                <span className="tag">PROYECTO ABP</span>
                <h2>
                  Modelado de la dinámica
                  <br />
                  <span>del aprendizaje</span>
                </h2>
                <p>
                  Analiza cómo evoluciona el conocimiento de los estudiantes a través del
                  tiempo utilizando ecuaciones diferenciales y datos reales de evaluación.
                </p>
                <button
                  className="primary-button"
                  onClick={() => setVista('estudiantes')}
                >
                  Ver estudiantes <span>→</span>
                </button>
              </div>

              <div className="equation-card">
                <div className="equation-label">MODELO MATEMÁTICO</div>
                <div className="equation">
                  <span>dA</span>
                  <span>=</span>
                  <span>k(M − A(t))</span>
                </div>
                <div className="equation-solution">
                  A(t) = M − (M − A₀)e<sup>−kt</sup>
                </div>
                <div className="equation-info">
                  Modelo de crecimiento del conocimiento
                </div>
              </div>
            </section>

            <section className="info-section">
              <div className="info-card">
                <div className="info-icon">👨‍🎓</div>
                <div>
                  <h3>Estudiantes</h3>
                  <p>Consulta los participantes del experimento.</p>
                </div>
              </div>

              <div className="info-card">
                <div className="info-icon">📝</div>
                <div>
                  <h3>Evaluaciones</h3>
                  <p>Registra y analiza los resultados obtenidos.</p>
                </div>
              </div>

              <div className="info-card">
                <div className="info-icon">📈</div>
                <div>
                  <h3>Modelo EDO</h3>
                  <p>Compara los datos reales con el modelo matemático.</p>
                </div>
              </div>
            </section>
          </>
        )}

        {vista === 'estudiantes' && (
          <section className="page-section">
            {!estudianteSeleccionado ? (
              <>
                <span className="tag">DATOS DEL EXPERIMENTO</span>
                <h2>Estudiantes</h2>
                <p className="page-description">
                  Selecciona un participante para consultar su información.
                </p>

                {cargando && (
                  <div className="empty-card">
                    <div className="empty-icon">⏳</div>
                    <h3>Cargando estudiantes...</h3>
                    <p>Consultando los datos almacenados en PostgreSQL.</p>
                  </div>
                )}

                {error && (
                  <div className="empty-card">
                    <div className="empty-icon">⚠️</div>
                    <h3>Error de conexión</h3>
                    <p>{error}</p>
                  </div>
                )}

                {!cargando && !error && (
                  <div className="students-grid">
                    {estudiantes.map((estudiante) => (
                      <button
                        className="student-card"
                        key={estudiante.id}
                        onClick={() => seleccionarEstudiante(estudiante)}
                      >
                        <div className="student-avatar">👨‍🎓</div>
                        <div className="student-info">
                          <span>{estudiante.codigo}</span>
                          <h3>{estudiante.nombre}</h3>
                          <p>Ver información del estudiante →</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="student-detail">
                <button className="back-button" onClick={volverEstudiantes}>
                  ← Volver a estudiantes
                </button>

                <div className="detail-card">
                  <div className="detail-avatar">👨‍🎓</div>
                  <div>
                    <span className="tag">PARTICIPANTE</span>
                    <h2>{estudianteSeleccionado.nombre}</h2>
                    <p>
                      Código: <strong>{estudianteSeleccionado.codigo}</strong>
                    </p>
                    <p>ID del estudiante: {estudianteSeleccionado.id}</p>
                  </div>
                </div>

                <div className="evaluations-section">
                  <span className="tag">SEGUIMIENTO</span>
                  <h2>Evaluaciones</h2>
                  <p className="page-description">
                    Resultados obtenidos durante el experimento.
                  </p>

                  {cargandoEvaluaciones && (
                    <div className="empty-card">
                      <div className="empty-icon">⏳</div>
                      <h3>Cargando evaluaciones...</h3>
                      <p>Consultando los resultados en PostgreSQL.</p>
                    </div>
                  )}

                  {errorEvaluaciones && (
                    <div className="empty-card">
                      <div className="empty-icon">⚠️</div>
                      <h3>Error</h3>
                      <p>{errorEvaluaciones}</p>
                    </div>
                  )}

                  {!cargandoEvaluaciones &&
                    !errorEvaluaciones &&
                    evaluaciones.length === 0 && (
                      <div className="empty-card">
                        <div className="empty-icon">📝</div>
                        <h3>Sin evaluaciones</h3>
                        <p>Este estudiante todavía no tiene evaluaciones registradas.</p>
                      </div>
                    )}

                  {!cargandoEvaluaciones &&
                    !errorEvaluaciones &&
                    evaluaciones.length > 0 && (
                      <div className="evaluations-grid">
                        {evaluaciones.map((evaluacion) => (
                          <article className="evaluation-card" key={evaluacion.id}>
                            <div className="evaluation-card-header">
                              <div className="evaluation-day">
                                <span>DÍA</span>
                                <strong>{evaluacion.tiempoDias}</strong>
                              </div>
                              <div className="evaluation-result">
                                <span>RESULTADO</span>
                                <strong>{evaluacion.porcentaje}%</strong>
                              </div>
                            </div>

                            <div className="evaluation-info">
                              <h3>Evaluación del día {evaluacion.tiempoDias}</h3>
                              <div className="evaluation-data">
                                <p>
                                  <span>Fecha</span>
                                  <strong>{evaluacion.fecha}</strong>
                                </p>
                                <p>
                                  <span>Respuestas correctas</span>
                                  <strong>
                                    {evaluacion.respuestasCorrectas} de {evaluacion.totalPreguntas}
                                  </strong>
                                </p>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}

                  {!cargandoAnalisis &&
                    !errorAnalisis &&
                    datosModelo.length > 0 && (
                      <div className="model-analysis">
                        <span className="tag">ANÁLISIS MATEMÁTICO</span>
                        <h2>Comparación real vs modelo</h2>
                        <p className="page-description">
                          El modelo utiliza los resultados del estudiante para calcular la
                          constante de aprendizaje y estimar la evolución esperada del
                          conocimiento.
                        </p>

                        <div className="model-summary">
                          <div className="model-summary-card">
                            <span>CONOCIMIENTO INICIAL A₀</span>
                            <strong>
                              {porcentajeInicial !== null ? porcentajeInicial + '%' : '--'}
                            </strong>
                          </div>

                          <div className="model-summary-card">
                            <span>CONSTANTE k</span>
                            <strong>{k !== null ? k.toFixed(4) : '--'}</strong>
                          </div>

                          <div className="model-summary-card">
                            <span>CONOCIMIENTO MÁXIMO</span>
                            <strong>100%</strong>
                          </div>

                          <div className="model-summary-card">
                            <span>ERROR PROMEDIO</span>
                            <strong>{errorPromedioIndividual.toFixed(2)}%</strong>
                          </div>

                          <div className="model-summary-card">
                            <span>RMSE</span>
                            <strong>{rmseIndividual.toFixed(2)}%</strong>
                          </div>

                          <div className="model-summary-card">
                            <span>R²</span>
                            <strong>{r2Individual.toFixed(4)}</strong>
                          </div>
                        </div>

                        <div className="model-table-card">
                          <span className="tag">INTERPRETACIÓN AUTOMÁTICA</span>
                          <h3>¿Qué significan estos resultados?</h3>
                          <p className="page-description">
                            <strong>Diferencia promedio:</strong> {interpretacionErrorIndividual}
                            {' '}Como orientación, se considera pequeña una diferencia de hasta 5 puntos porcentuales y moderada hasta 10; estos límites son una guía práctica, no una regla universal.
                          </p>
                          <p className="page-description">
                            <strong>Constante k:</strong> {interpretacionKIndividual}
                          </p>
                          <p className="page-description">
                            <strong>Coeficiente R²:</strong> {interpretacionR2Individual}
                          </p>
                          <p className="page-description">
                            <strong>Importante:</strong> esta lectura se genera a partir de las métricas calculadas y describe únicamente los datos disponibles; no demuestra por sí sola cuánto aprende una persona ni garantiza resultados futuros.
                          </p>
                        </div>

                        <div className="model-table-card">
                          <span className="tag">VALIDACIÓN DEL MODELO</span>
                          <h3>Comparación de resultados reales vs. modelo</h3>
                          <p className="page-description">
                            La diferencia se calcula restando la estimación del modelo al resultado real y tomando el valor absoluto. Se expresa en puntos porcentuales (pp), no como porcentaje del error.
                          </p>

                          <div className="chart-legend" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <i style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e' }}></i>
                              Pequeña: hasta 5 pp
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <i style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }}></i>
                              Moderada: más de 5 y hasta 10 pp
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <i style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }}></i>
                              Alta: más de 10 pp
                            </span>
                          </div>

                          <div className="model-table-wrapper">
                            <table className="model-table">
                              <thead>
                                <tr>
                                  <th>Día</th>
                                  <th>Resultado real</th>
                                  <th>Modelo EDO</th>
                                  <th>Diferencia absoluta</th>
                                  <th>Evaluación del ajuste</th>
                                </tr>
                              </thead>
                              <tbody>
                                {datosValidosModelo.map((dato) => {
                                  const diferencia = Math.abs(
                                    Number(dato.porcentajeReal) - Number(dato.porcentajeModelo)
                                  )
                                  const estado = clasificarDiferencia(diferencia)

                                  return (
                                    <tr key={dato.tiempoDias}>
                                      <td>{dato.tiempoDias}</td>
                                      <td>{Number(dato.porcentajeReal).toFixed(2)}%</td>
                                      <td>{Number(dato.porcentajeModelo).toFixed(2)}%</td>
                                      <td>{diferencia.toFixed(2)} pp</td>
                                      <td>
                                        <span
                                          title={estado.descripcion}
                                          style={{
                                            display: 'inline-block',
                                            padding: '5px 10px',
                                            borderRadius: '999px',
                                            backgroundColor: estado.fondo,
                                            color: estado.color,
                                            fontSize: '0.82rem',
                                            fontWeight: 700,
                                            whiteSpace: 'nowrap'
                                          }}
                                        >
                                          {estado.texto}
                                        </span>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>

                          {datosValidosModelo.length === 0 && (
                            <p className="page-description">
                              No hay datos completos disponibles para comparar los resultados reales con el modelo.
                            </p>
                          )}

                          <p className="page-description" style={{ marginTop: '14px' }}>
                            Estos rangos son criterios prácticos de lectura para este proyecto, no límites universales de validez matemática. La calidad global del ajuste también debe revisarse junto con el error promedio, el RMSE y R².
                          </p>
                        </div>

                        <div className="model-chart-card">
                          <div className="model-chart-header">
                            <div>
                              <span className="tag">EVOLUCIÓN</span>
                              <h3>Aprendizaje a través del tiempo</h3>
                            </div>

                            <div className="chart-legend">
                              <span>
                                <i className="legend-real"></i>
                                Resultado real
                              </span>
                              <span>
                                <i className="legend-model"></i>
                                Modelo EDO
                              </span>
                            </div>
                          </div>

                          <div className="chart-container">
                            <svg
                              viewBox="0 0 760 320"
                              className="learning-chart"
                              preserveAspectRatio="none"
                            >
                              {[0, 20, 40, 60, 80, 100].map((valor) => {
                                const y = 25 + ((100 - valor) / 100) * 250
                                return (
                                  <g key={valor}>
                                    <line
                                      x1="55"
                                      y1={y}
                                      x2="735"
                                      y2={y}
                                      className="chart-grid-line"
                                    />
                                    <text
                                      x="45"
                                      y={y + 4}
                                      className="chart-axis-text"
                                      textAnchor="end"
                                    >
                                      {valor}%
                                    </text>
                                  </g>
                                )
                              })}

                              <line
                                x1="55"
                                y1="25"
                                x2="55"
                                y2="275"
                                className="chart-axis-line"
                              />
                              <line
                                x1="55"
                                y1="275"
                                x2="735"
                                y2="275"
                                className="chart-axis-line"
                              />

                              <polyline
                                points={crearPuntosGrafica('porcentajeReal')}
                                className="chart-line chart-line-real"
                              />
                              <polyline
                                points={crearPuntosGrafica('porcentajeModelo')}
                                className="chart-line chart-line-model"
                              />

                              {puntosReales.map((punto) => (
                                <g key={'real-' + punto.dia}>
                                  <circle
                                    cx={punto.x}
                                    cy={punto.y}
                                    r="5"
                                    className="chart-point chart-point-real"
                                  />
                                  <text
                                    x={punto.x}
                                    y={punto.y - 12}
                                    className="chart-value-real"
                                    textAnchor="middle"
                                  >
                                    {punto.valor.toFixed(1)}%
                                  </text>
                                </g>
                              ))}

                              {puntosModelo.map((punto) => (
                                <g key={'modelo-' + punto.dia}>
                                  <circle
                                    cx={punto.x}
                                    cy={punto.y}
                                    r="5"
                                    className="chart-point chart-point-model"
                                  />
                                  <text
                                    x={punto.x}
                                    y={punto.y + 20}
                                    className="chart-value-model"
                                    textAnchor="middle"
                                  >
                                    {punto.valor.toFixed(1)}%
                                  </text>
                                </g>
                              ))}

                              {datosModelo.map((dato) => {
                                const maxX = Math.max(
                                  ...datosModelo.map((item) => item.tiempoDias)
                                )

                                if (maxX === 0) return null

                                const x = 55 + (dato.tiempoDias / maxX) * 680

                                return (
                                  <text
                                    key={'dia-' + dato.tiempoDias}
                                    x={x}
                                    y="298"
                                    className="chart-axis-text"
                                    textAnchor="middle"
                                  >
                                    Día {dato.tiempoDias}
                                  </text>
                                )
                              })}
                            </svg>
                          </div>
                        </div>

                        <div className="model-formula-card">
                          <span>ECUACIÓN UTILIZADA</span>
                          <div className="model-formula">
                            A(t) = M − (M − A₀)e<sup>−kt</sup>
                          </div>
                          <p>
                            Para este estudiante, el sistema utiliza M = 100%, el porcentaje
                            inicial como A₀ y la constante k calculada a partir de sus
                            evaluaciones.
                          </p>
                        </div>

                        <div className="model-table-card">
                          <span className="tag">PREDICCIÓN</span>
                          <h3>Predicción del aprendizaje</h3>
                          <p className="page-description">
                            Utiliza el modelo matemático para estimar el conocimiento del
                            estudiante en un día futuro.
                          </p>

                          <div className="model-summary">
                            <div className="model-summary-card">
                              <span>DÍA A PREDECIR</span>
                              <input
                                type="number"
                                min="0"
                                value={diaPrediccion}
                                onChange={(e) => setDiaPrediccion(e.target.value)}
                              />
                            </div>

                            <div className="model-summary-card">
                              <span>CONOCIMIENTO ESTIMADO</span>
                              <strong>
                                {prediccionIndividual !== null
                                  ? prediccionIndividual.toFixed(2) + '%'
                                  : '--'}
                              </strong>
                            </div>
                          </div>

                          {prediccionIndividual !== null && (
                            <p className="page-description">
                              Para el día {Number(diaPrediccion)}, el modelo estima un nivel
                              de conocimiento de {prediccionIndividual.toFixed(2)}%.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                  {cargandoAnalisis && (
                    <div className="empty-card">
                      <div className="empty-icon">📈</div>
                      <h3>Calculando modelo matemático...</h3>
                      <p>Analizando los resultados y calculando la constante k.</p>
                    </div>
                  )}

                  {errorAnalisis && (
                    <div className="empty-card">
                      <div className="empty-icon">⚠️</div>
                      <h3>Error en el análisis</h3>
                      <p>{errorAnalisis}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {vista === 'evaluaciones' && (
          <section className="page-section">
            <span className="tag">ANÁLISIS DEL EXPERIMENTO</span>
            <h2>Resultados generales</h2>
            <p className="page-description">
              Análisis conjunto de la evolución del aprendizaje de los estudiantes y
              comparación con el modelo de ecuaciones diferenciales.
            </p>


            {cargandoResumen && (
              <div className="empty-card">
                <div className="empty-icon">⏳</div>
                <h3>Cargando análisis general...</h3>
                <p>Consultando los resultados almacenados en PostgreSQL.</p>
              </div>
            )}

            {errorResumen && (
              <div className="empty-card">
                <div className="empty-icon">⚠️</div>
                <h3>Error</h3>
                <p>{errorResumen}</p>
              </div>
            )}

            {!cargandoResumen && !errorResumen && resumen.length > 0 && (
              <>
                <div className="model-summary">
                  <div className="model-summary-card">
                    <span>ESTUDIANTES</span>
                    <strong>{estudiantesResumen.length}</strong>
                  </div>

                  <div className="model-summary-card">
                    <span>PROMEDIO INICIAL A₀</span>
                    <strong>{promedioInicialGeneral.toFixed(1)}%</strong>
                  </div>

                  <div className="model-summary-card">
                    <span>PROMEDIO FINAL</span>
                    <strong>{promedioFinalGeneral.toFixed(1)}%</strong>
                  </div>

                  <div className="model-summary-card">
                    <span>PROMEDIO k</span>
                    <strong>{promedioKGeneral.toFixed(4)}</strong>
                  </div>

                  <div className="model-summary-card">
                    <span>ERROR PROMEDIO</span>
                    <strong>{promedioErrorGeneral.toFixed(2)}%</strong>
                  </div>

                  <div className="model-summary-card">
                    <span>RMSE</span>
                    <strong>{promedioRMSEGeneral.toFixed(2)}%</strong>
                  </div>

                  <div className="model-summary-card">
                    <span>R²</span>
                    <strong>{promedioR2General.toFixed(4)}</strong>
                  </div>
                </div>

                <div className="model-chart-card">
                  <div className="model-chart-header">
                    <div>
                      <span className="tag">RESULTADOS GENERALES</span>
                      <h3>Evolución promedio del grupo</h3>
                    </div>

                    <div className="chart-legend">
                      <span>
                        <i className="legend-real"></i>
                        Promedio real
                      </span>
                      <span>
                        <i className="legend-model"></i>
                        Modelo EDO
                      </span>
                    </div>
                  </div>

                  <div className="chart-container">
                    <svg
                      viewBox="0 0 760 320"
                      className="learning-chart"
                      preserveAspectRatio="none"
                    >
                      {[0, 20, 40, 60, 80, 100].map((valor) => {
                        const y = 25 + ((100 - valor) / 100) * 250

                        return (
                          <g key={valor}>
                            <line
                              x1="55"
                              y1={y}
                              x2="735"
                              y2={y}
                              className="chart-grid-line"
                            />
                            <text
                              x="45"
                              y={y + 4}
                              className="chart-axis-text"
                              textAnchor="end"
                            >
                              {valor}%
                            </text>
                          </g>
                        )
                      })}

                      <line
                        x1="55"
                        y1="25"
                        x2="55"
                        y2="275"
                        className="chart-axis-line"
                      />
                      <line
                        x1="55"
                        y1="275"
                        x2="735"
                        y2="275"
                        className="chart-axis-line"
                      />

                      <polyline
                        points={crearPuntosResumen('promedioReal')}
                        className="chart-line chart-line-real"
                      />
                      <polyline
                        points={crearPuntosResumen('promedioModelo')}
                        className="chart-line chart-line-model"
                      />

                      {puntosRealesResumen.map((punto) => (
                        <g key={'general-real-' + punto.dia}>
                          <circle
                            cx={punto.x}
                            cy={punto.y}
                            r="5"
                            className="chart-point chart-point-real"
                          />
                          <text
                            x={punto.x}
                            y={punto.y - 12}
                            className="chart-value-real"
                            textAnchor="middle"
                          >
                            {punto.valor.toFixed(1)}%
                          </text>
                        </g>
                      ))}

                      {puntosModeloResumen.map((punto) => (
                        <g key={'general-modelo-' + punto.dia}>
                          <circle
                            cx={punto.x}
                            cy={punto.y}
                            r="5"
                            className="chart-point chart-point-model"
                          />
                          <text
                            x={punto.x}
                            y={punto.y + 20}
                            className="chart-value-model"
                            textAnchor="middle"
                          >
                            {punto.valor.toFixed(1)}%
                          </text>
                        </g>
                      ))}

                      {promediosPorDia.map((dato) => {
                        const maxX = Math.max(
                          ...promediosPorDia.map((item) => item.dia)
                        )

                        if (maxX === 0) return null

                        const x = 55 + (dato.dia / maxX) * 680

                        return (
                          <text
                            key={'general-dia-' + dato.dia}
                            x={x}
                            y="298"
                            className="chart-axis-text"
                            textAnchor="middle"
                          >
                            Día {dato.dia}
                          </text>
                        )
                      })}
                    </svg>
                  </div>
                </div>

                <div className="model-table-card">
                  <h3>Comparación por estudiante</h3>
                  <div className="model-table-wrapper">
                    <table className="model-table">
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Estudiante</th>
                          <th>A₀</th>
                          <th>Final</th>
                          <th>k</th>
                          <th>Error promedio</th>
                          <th>RMSE</th>
                          <th>R²</th>
                        </tr>
                      </thead>

                      <tbody>
                        {datosFinales.map((estudiante) => (
                          <tr key={estudiante.id}>
                            <td>{estudiante.codigo}</td>
                            <td>{estudiante.nombre}</td>
                            <td>{estudiante.A0.toFixed(1)}%</td>
                            <td>{estudiante.final.toFixed(1)}%</td>
                            <td>{estudiante.k.toFixed(4)}</td>
                            <td>{estudiante.errorPromedio.toFixed(2)}%</td>
                            <td>{estudiante.rmse.toFixed(2)}%</td>
                            <td>{estudiante.r2.toFixed(4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="model-table-card">
                  <span className="tag">PREDICCIÓN GRUPAL</span>
                  <h3>Proyección del aprendizaje del grupo</h3>
                  <p className="page-description">
                    Estimación del nivel promedio de conocimiento del grupo en días
                    posteriores al periodo de evaluación. La predicción se obtiene
                    calculando el modelo individual de cada estudiante y promediando
                    sus resultados.
                  </p>

                  <div className="model-table-wrapper">
                    <table className="model-table">
                      <thead>
                        <tr>
                          <th>Día</th>
                          <th>Conocimiento promedio estimado</th>
                          <th>Estudiantes incluidos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prediccionesGrupales.map((prediccion) => (
                          <tr key={prediccion.dia}>
                            <td>{prediccion.dia}</td>
                            <td>{prediccion.promedio.toFixed(2)}%</td>
                            <td>{prediccion.cantidadEstudiantes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="page-description">
                    Estas cifras representan una proyección matemática y no sustituyen
                    las evaluaciones reales que se realizarán durante el experimento.
                  </p>
                </div>
              </>
            )}
          </section>
        )}

        {vista === 'modelo' && (
          <section className="page-section">
            <span className="tag">ECUACIÓN DIFERENCIAL</span>
            <h2>Modelo matemático del aprendizaje</h2>
            <p className="page-description">
              Este modelo representa una situación en la que el conocimiento aumenta
              con el tiempo y se aproxima progresivamente a un nivel máximo.
            </p>

            <div className="model-card">
              <span className="tag">1. ECUACIÓN DIFERENCIAL</span>
              <div className="model-equation">
                dA/dt = k(M − A(t))
              </div>
              <p className="page-description">
                La tasa de cambio del aprendizaje depende de la diferencia entre el
                conocimiento máximo y el conocimiento alcanzado. Cuanto mayor sea esa
                diferencia, mayor puede ser el crecimiento estimado por el modelo.
              </p>

              <span className="tag">2. SOLUCIÓN UTILIZADA POR EL SISTEMA</span>
              <div className="model-equation">
                A(t) = M − (M − A₀)e<sup>−kt</sup>
              </div>

              <div className="variables">
                <div>
                  <strong>A(t)</strong>
                  <span>Porcentaje de conocimiento estimado en el día t.</span>
                </div>
                <div>
                  <strong>M</strong>
                  <span>Nivel máximo definido; en el proyecto se usa 100%.</span>
                </div>
                <div>
                  <strong>A₀</strong>
                  <span>Porcentaje obtenido en la evaluación del día cero.</span>
                </div>
                <div>
                  <strong>k</strong>
                  <span>Constante que representa la rapidez de crecimiento estimada.</span>
                </div>
                <div>
                  <strong>t</strong>
                  <span>Tiempo transcurrido, medido en días desde la evaluación inicial.</span>
                </div>
              </div>
            </div>

            <div className="model-card">
              <span className="tag">3. ¿CÓMO LO APLICA EL SISTEMA?</span>
              <div className="variables">
                <div>
                  <strong>01. Datos reales</strong>
                  <span>Se consultan las evaluaciones del estudiante almacenadas en el sistema.</span>
                </div>
                <div>
                  <strong>02. Valor inicial</strong>
                  <span>Se toma el resultado del día cero como A₀.</span>
                </div>
                <div>
                  <strong>03. Estimación de k</strong>
                  <span>El modelo busca el valor de k que reduce el error entre las evaluaciones reales y las estimaciones del modelo.</span>
                </div>
                <div>
                  <strong>04. Comparación</strong>
                  <span>Se calcula A(t) para los días evaluados y se comparan los valores reales con los estimados.</span>
                </div>
              </div>
            </div>

            <div className="model-card">
              <span className="tag">4. INTERPRETACIÓN</span>
              <p className="page-description">
                Si k es mayor, el modelo representa un acercamiento más rápido al nivel
                máximo. Si k es menor, el acercamiento es más lento. El valor estimado
                no demuestra por sí solo cuánto aprende una persona: sirve para analizar
                y comparar los resultados disponibles.
              </p>
              <p className="page-description">
                <strong>Importante:</strong> las predicciones son aproximaciones
                matemáticas basadas en los datos registrados; no sustituyen las
                evaluaciones reales ni garantizan el comportamiento futuro del estudiante.
              </p>
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <p>Proyecto ABP · Teoría del aprendizaje · Ecuaciones diferenciales</p>
        <span>Universidad del Sinú</span>
      </footer>
    </div>
  )
}

export default App