import objectAssign from 'object-assign'

Object.assign = Object.assign || objectAssign

/**
 * Helper to figure out what type of dat.Controller we are modifying
 */
const getControllerType = (controller) => {
  if (controller.__li.classList.contains('color')) {
    return 'color'
  } else {
    const type = typeof controller.getValue()
    if (type === 'number' || type === 'boolean') {
      return type
    } else {
      return 'option'
    }
  }
}

const map = ( value, in_min , in_max , out_min , out_max) => {
  return ( value - in_min ) * ( out_max - out_min ) / ( in_max - in_min ) + out_min
}

/**
 * A map of each controller type to its method handler name
 */
const controllerMap = {
  'color': 'handleColorControl',
  'boolean': 'handleBooleanControl',
  'number': 'handleNumberControl',
  'option': 'handleOptionControl'
}
/**
 * Root Firebase reference that contains all the associated gui params
 */
const DEFAULT_ROOT_DB = "things/"

/**
 * dat.fire
 *
 * Connecting and updating dat.gui interfaces via Firebase Realtime Database
 *
 * @author Anthony Tripaldi @ Google Creative Lab
 */
export default class DatFire {

  /**
   * Create an instance of dat.fire.
   *
   * Once created, initialize it with {@link init(gui, controllers, params)}
   *
   * @param database initialized and configured instance of Firebase.database()
   */
  constructor(database) {
    this.database = database

    this.controllers = []
    this.currentControllerIndex = -1

    this.handleValueChange = this.handleValueChange.bind(this)
  }

  /**
   * Initialize dat.fire by connecting our controllers to Firebase database References.
   *
   *
   *
   * @param {dat.GUI} gui Initialized and completed dat.GUI instance. Only call this after you are finished adding controllers.
   * @param {Array} [controllers] Optional array of specific controllers to be added to dat.fire. If not present, we'll automatically add all controllers in our passed GUI instance.
   * @param {Object} [params] Optional parameters. See {@link #getDefaultParams()} or read above for more info.
   */
  init(gui, controllers, params) {
    this.gui = gui

    if (controllers && Array.isArray(controllers)) {
      this.addControllers(controllers)
    } else {
      this.addAllControllersFromGui()
    }

    this.handleParams(params)

    if (this.params.usePrevNext) {
      this.initPrevNext()
    } else {
      this.controllers.forEach((ctrlObj) => {
        this.database.ref(this.params.dbRef + ctrlObj.controller.property)
          .on('value', this.handleValueChange)
      })
    }
  }

  initPrevNext() {
    this.handlePrev = this.handlePrev.bind(this)
    this.handleNext = this.handleNext.bind(this)

    this.database.ref(this.params.dbRef + this.params.prevRef)
      .on('value', this.handlePrev)

    this.database.ref(this.params.dbRef + this.params.nextRef)
      .on('value', this.handleNext)

    this.database.ref(this.params.dbRef + this.params.dialRef)
      .on('value', this.handleValueChange)

    this.handleNext(true)
  }

  handleParams(params) {
    this.params = params = Object.assign({}, DatFire.getDefaultParams(), params)
  }

  handlePrev(prev) {
    prev = prev.val ? prev.val() : prev
    if (prev) {
      this.currentControllerIndex--;

      if (this.currentControllerIndex < 0 ) {
        this.currentControllerIndex = this.controllers.length - 1;
      }

      if (this.currentController) {
        this.removeBackground(this.currentController)
      }

      this.currentController = this.controllers[this.currentControllerIndex]
      this.addBackground(this.currentController)
    }
  }

  handleNext(next) {
    next = next.val ? next.val() : next
    if (next) {
      this.currentControllerIndex++;

      if (this.currentControllerIndex >= this.controllers.length) {
        this.currentControllerIndex = 0
      }

      if (this.currentController) {
        this.removeBackground(this.currentController)
      }

      this.currentController = this.controllers[this.currentControllerIndex]
      this.addBackground(this.currentController)
    }
  }

  handleValueChange(val) {
    if (this.controllers.length && val) {
      this.currentController = this.getControllerByKey(val.key)
      const type = getControllerType(this.currentController)
      this[controllerMap[type]] && this[controllerMap[type]](val.val())
    }
  }

  handleNumberControl(dialValue) {
    this.currentController.setValue(
      map(dialValue, 0, 1, this.currentController.__min, this.currentController.__max)
    )
  }

  handleBooleanControl(val) {
    if(val > .5)
      this.currentController.setValue(true)
    else
      this.currentController.setValue(false)
  }

  handleColorControl(val) {
    if(val) {
      // based on the code at https://github.com/dataarts/dat.gui/blob/master/src/dat/controllers/ColorController.js#L234
      // since setting value via setValue on its own doesn't do anything.
      // also need to explicitly set .s & .v since apparently, even in normal dat.gui, changing hue first doesn't
      // affect the color until you've clicked once on saturation field, so doing that here.
      // TODO(atripaldi) find best way to make this configurable per-controller without changing dat.gui
      this.currentController.__color.h = val * 360
      this.currentController.__color.s = 1
      this.currentController.__color.v = .5
      this.currentController.setValue(this.currentController.__color.toOriginal())
    }
  }

  handleOptionControl(val) {
    this.currentController.__select.selectedIndex = Math.floor(val * this.currentController.__select.childNodes.length)
  }

  addAllControllersFromGui() {
    if (this.gui.__controllers.length) {
      this.addControllers(this.gui.__controllers)
    }

    for (let folder in this.gui.__folders) {
      let controllers = this.gui.__folders[folder].__controllers
      if (controllers.length)
        this.addControllers(controllers)
    }
  }

  addControllers(controllers) {
    let mappedControllers = []
    controllers.forEach((ctrl) => {
      mappedControllers.push({'key': ctrl.property, 'controller': ctrl})
    })

    this.controllers = this.controllers.concat(mappedControllers)
  }

  getControllerByKey(key) {
    for(let i = 0; i < this.controllers.length; i++) {
      if(this.controllers[i].key === key)
        return this.controllers[i].controller
    }
  }

  removeBackground(controller) {
    this.getParent(controller).style.backgroundColor = ""
  }

  addBackground(controller) {
    this.getParent(controller).style.backgroundColor = "#555555"
  }

  getParent(controller) {
    return controller.domElement.parentElement.parentElement
  }

  /**
   * Returns the default parameters for dat.fire. They are:
   * * dbRef: string - the top-level database ref in your Firebase schema.
   * * (next|prev|dial)Ref: string - the individual ref names for each of the simple controls
   * * usePrevNext: boolean - dat.fire will only expect to use a single dial with two buttons for iterating through an arbitrarily sized list of controllers
   * * simpleGui: boolean - "Installation Mode" - whether or not we want to auto-hide dat.gui and only show items that are currently being updated.
   *
   * @returns {{dbRef: string, nextRef: string, prevRef: string, dialRef: string, simpleGui: boolean}}
   */
  static getDefaultParams() {
    return {
      dbRef: DEFAULT_ROOT_DB,
      nextRef: "next",
      prevRef: "prev",
      dialRef: "dial",
      usePrevNext: false,
      simpleGui: false
    }
  }
}
