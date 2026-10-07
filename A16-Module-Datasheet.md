# A16 Series Sensor Module --- Datasheet

> **Source:** A16-Module Datasheet.pdf\
> **Document:** A16 Series Sensor Module\
> **Brand shown on cover:** BEST SENSOR / OATASHEET\
> **Document length:** 9 PDF pages (cover + table of contents +
> technical pages)

------------------------------------------------------------------------

## Document structure

The original document contains the following sections:

1.  Product Description
    -   General
    -   Features
    -   Applications
2.  Module Specification
    -   Operating specification
    -   Environment
    -   Electronics
3.  Sensor Selection Instruction
4.  Beam Pattern
5.  Reliable Testing Condition / Reliable Testing Instruction
6.  Notice
7.  Mechanics
    -   Mechanical Dimensions
    -   Parts Description
    -   Pin Out

------------------------------------------------------------------------

# 1. Product Description

## 1.1 General

A16 series module uses proven ultrasonic sensing technology for distance
measurement. Adopts high-performance processor and superior quality
elements which output reliable stability value and has long life span.
Waterproof ultrasonic transducer with strong adaptability to various
operating environment. This module built-in high precision ranging
algorithm and power consumption management procedure, has high ranging
accuracy, low power consumption, long measuring distance and narrow
measurement angle features.

## 1.2 Features

-   Adopting reflective structure, long detection distance and small
    beam angle
-   Adopting smart signal processing circuit, small blind zone
-   Build-in high accuracy ranging algorithm, minimum error\<5mm
-   Controllable measuring angle, high sensitivity, strong
    anti-interference ability
-   Build-in true target recognition algorithm, high recognition
    accuracy of target
-   Multiple output interfaces optional, PWM, UART, Switch, RS232, RS485
-   Internal temperature compensation function, stable range from -15°C
    to +60°C
-   Low power consumption design, static current \<15uA, operating
    current \<10mA (5VDC power input)
-   Wide voltage supply, 3.3-24V applicable
-   Anti-static electricity design in accordance with IEC61000-4-2
    standard
-   Operating temperature from -15°C to +60°C

## 1.3 Applications

-   Horizontal distance sensing
-   Object proximity and presence awareness
-   Dam water level monitoring

------------------------------------------------------------------------

# 2. Module Specification

## 2.1 Operating Specification

### Operating specification table

  ------------------------------------------------------------------------------------------------------------------
  Item              PWM output     UART Auto          UART Switch output  RS232 output  RS485 output Unit   Remark
  Description                                   Controlled                                                  
  -------------- ------------- ------------- ------------- ------------- ------------- ------------- ------ --------
  Operating            3.3\~24       3.3\~24       3.3\~24       3.3\~24       3.3\~24       3.3\~24 V DC   ---
  voltage                                                                                                   

  Standby                  ≤15            \-           ≤15            \-            \-            \- uA     \(1\)
  current                                                                                                   

  Average                  ≤15           ≤15           ≤15           ≤15           ≤15           ≤15 mA     \(1\)
  operating                                                                                                 
  current                                                                                                   

  Blind zone                50            50            50            50            50            50 cm     \(2\)

  Measuring           50\~1500      50\~1500      50\~1500      50\~1500      50\~1500      50\~1500 cm     \(2\)
  range of flat                                                                                             
  object                                                                                                    

  Beam angle              ≈40°          ≈40°          ≈40°          ≈40°          ≈40°          ≈40° \-     \(3\)

  Accuracy         ±(1+S×0.3%)   ±(1+S×0.3%)   ±(1+S×0.3%)   ±(1+S×0.3%)   ±(1+S×0.3%)   ±(1+S×0.3%) cm     \(4\)

  Temp                 Support       Support       Support       Support       Support       Support ---    ---
  Compensation                                                                                              
  ------------------------------------------------------------------------------------------------------------------

> **Note:** The source table visually merges several cells across output
> modes. The repeated values above represent the same specification
> shown as applying across the listed output interfaces.

### Notes for operating specification

**(1)** Typical data obtained from a test with a temperature of about
25°C, power supply of 12V, 500ms duty cycle.

**(2)** The temperature is about 25°C, the measured object is a
50cm×60cm flat carton, and the transducer must be as vertical as
possible to the measured object.

**(3)** The measured object is the reference data obtained from the test
of a φ75mm×100cm white PVC pipe with a distance of 100cm.

**(4)** The temperature is about 25°C, and the indoor environment
without wind, the measured object is a 50cm×60cm flat carton, and S
means the measuring distance.

------------------------------------------------------------------------

## 2.2 Environment

  Item                   Minimum value   Typical value   Max value Unit   Remark
  -------------------- --------------- --------------- ----------- ------ --------
  Storage Temp                     -25              25          80 °C     
  Storage Humidity                 ---             65%         90% RH     \(1\)
  Operating Temp                   -15              25          60 °C     
  Operating Humidity               ---             65%         80% RH     \(2\)

### Environment remarks

**(1)** Environment temperature is 0-39°C, max humidity is 90%
(Non-condensation).

**(2)** Environment is 40-50°C, max humidity is the highest at current
temperature in nature.

------------------------------------------------------------------------

## 2.3 Electronics

  Item                  Minimum value   Typical value   Max value Unit   Remark
  ------------------- --------------- --------------- ----------- ------ ------------
  Operating voltage               3.2             5.0          24 V      Peak value
  Peak current                     50             ---          70 mA     Peak value
  Input Ripple                    ---             ---          50 mV     Peak value
  Input Noise                     ---             ---         100 mV     Peak value
  ESD                             ---             ---    ±200/±2K V      \(1\)
  ESD                             ---             ---     ±4K/±8K V      \(2\)

### Electronics remarks

**1)** The static electricity specification of assembly line, contact
static electricity should not be higher than ±200V, and air static
electricity should not be higher than ±2KV.

**(2)** The probe shell and output lead comply with the IEC61000-4-2
standard.

------------------------------------------------------------------------

# 3. Sensor Selection Instruction

The A16-module providing variety of output formats, customer can choose
the corresponding model according to actual application needs.

## A16 Series Sensor Module --- Model Selection

  No.                        Output interface   Model No.           Remark
  -------------------------- ------------------ ------------------- --------
  A16 Series sensor module   PWM output         DYP-A16NYMW-V1.0    
  A16 Series sensor module   UART Auto          DYP-A16NYUW-V1.0    
  A16 Series sensor module   UART Controlled    DYP-A16NYTW-V1.0    
  A16 Series sensor module   Switch output      DYP-A16NYGDW-V1.0   
  A16 Series sensor module   RS232              DYP-A16NY2W-V1.0    
  A16 Series sensor module   RS485              DYP-A16NY4W-V1.0    

------------------------------------------------------------------------

# 4. Beam Pattern

The datasheet provides beam-pattern test diagrams for two different
target types.

## 4.1 Test object 1 --- White PVC cylindrical tube

The tested object is a white cylindrical tube made of PVC material, with
a height of **100 cm** and a diameter of **7.5 cm**.

The diagram shows the ultrasonic beam pattern across angles from
approximately **0° at the center to ±90°**, with the response/distance
scale shown on the radial axis.

The accompanying illustration states that the **PVC pipe moves left and
right parallel to the ultrasonic probe**.

## 4.2 Test object 2 --- Corrugated box

The tested object is a corrugated box perpendicular to the **0° central
axis**, with a **length × width of 60 cm × 50 cm**.

The diagram shows the ultrasonic beam pattern across angles from
approximately **0° at the center to ±90°**, with the radial scale
extending to approximately **16** on the outer scale.

The accompanying illustration states that the **corrugated box moves
left and right parallel to the ultrasonic probe**.

> **Diagram note:** The original beam-pattern plots are graphical test
> curves. Their axes and target/test conditions are retained here in
> text; the plotted curve itself is not numerically reproduced
> point-by-point because the source provides it as a graph rather than a
> numeric data table.

------------------------------------------------------------------------

# 5. Reliable Testing Instruction

  -----------------------------------------------------------------------------------
               No. Description   Testing condition            Sample QTY Remark
  ---------------- ------------- ---------------------- ---------------- ------------
                 1 High          65°C, 85%RH, Power                    3 
                   temperature   ON@5V, 72hrs                            
                   and humidity                                          

                 2 low           -20°C, Power                          3 
                   temperature   ON@5V,72hrs                             

                 3 High          80°C, 80%RH, storage,                 3 
                   temperature   72hrs                                   
                   and humidity                                          
                   storage                                               

                 4 Low           -30°C, storage, 72hrs                 3 
                   temperature                                           
                   storage                                               

                 5 Vibration     10-200Hz,15min,2.0G,                  3 
                   test          XYZ three axes, each                    
                                 axis is 0.5 hours                       

                 6 Drop test     120 cm free fall, 5                   3 
                                 times on wooden floor                   
  -----------------------------------------------------------------------------------

### Testing note

After the test, the module is determined to be OK after the function
test, and the performance degradation rate is **≤10%**.

------------------------------------------------------------------------

# 6. Notice

1.  When two or more modules are used in the application scenario, it is
    recommended to use a module with controlled output (high-level pulse
    width output, UART controlled output), and use a time-sharing work
    method to prevent mutual communication between modules interference.
2.  In an environment with fast wind speed, the measurement and accuracy
    of the module will be affected. You can contact our sales to confirm
    related matters.
3.  Please pay attention to the evaluation of electromagnetic
    compatibility when designing. Unreasonable system design may cause
    malfunction of the module.
4.  When it comes to the application of the module limit parameter
    boundary, you can contact our engineer to confirm the relevant
    precautions.
5.  The company reserves the right to change this document and update
    the functions without prior notice.

------------------------------------------------------------------------

# 7. Mechanics

## 7.1 Mechanical Dimensions (mm-inch)

The source drawing specifies the following dimensions:

  Dimension                             Metric       Inch
  -------------------------------- ----------- ----------
  Overall transducer body height       50.1 mm    1.97 in
  Transducer body diameter           Ø55.67 mm    2.19 in
  Top thickness                           3 mm    0.12 in
  Overall mounting plate width           70 mm    2.76 in
  Mounting-hole center spacing           52 mm    2.05 in
  Mounting hole diameter              Ø4.04 mm    0.16 in
  Mounting plate corner radius          R10 mm    0.39 in
  Cable length                          300 mm   11.81 in

### Mechanical drawing details

The mechanical drawing contains: - A side view of the ultrasonic
transducer body and cable. - A top view showing the square mounting
plate, four mounting holes, circular transducer body, and cable exit. -
The **70 × 70 mm** mounting plate dimensions. - The **52 × 52 mm**
mounting-hole center dimensions. - **Ø4.04 mm \[0.16\]** mounting
holes. - **R10 mm \[0.39\]** corner radius. - **300 mm \[11.81\]** cable
length. - **Ø55.67 mm \[2.19\]** circular transducer body diameter. -
**50.1 mm \[1.97\]** body height. - **3 mm \[0.12\]** top thickness.

------------------------------------------------------------------------

## 7.2 Parts Description

The parts diagram identifies three main components:

1.  **Ultrasonic transducer**
2.  **Wire**
3.  **HY2.0-4Y plug**

------------------------------------------------------------------------

## 7.3 Pin Out

### Connector diagram

The connector is shown with four pins and four wire positions.

### Pin assignment

  ------------------------------------------------------------------------
                Pin No. Mark             Description      Remark
  --------------------- ---------------- ---------------- ----------------
                      1 VCC              Power Input      

                      2 GND              GND              

                      3 RX               Functional PIN   different output
                                                          modes have
                                                          different
                                                          functions

                      4 TX               Functional PIN   different output
                                                          modes have
                                                          different
                                                          functions
  ------------------------------------------------------------------------

### Pin-out note

The pin function setting followed customer's order, can't coexist with
other output modes.

------------------------------------------------------------------------

# Quick Technical Reference

## Core measurement specifications

  -----------------------------------------------------------------------
  Parameter                           Specification
  ----------------------------------- -----------------------------------
  Operating voltage                   3.3\~24 V DC

  Electronics operating voltage       3.2\~24 V, typical 5.0 V

  Standby current                     ≤15 uA (where specified)

  Average operating current           ≤15 mA

  Blind zone                          50 cm

  Measuring range of flat object      50\~1500 cm

  Beam angle                          ≈40°

  Accuracy                            ±(1+S×0.3%) cm

  Temperature compensation            Support

  Operating temperature               -15°C to +60°C

  Storage temperature                 -25°C to +80°C

  Operating humidity                  65% typical, 80% max

  Storage humidity                    65% typical, 90% max

  Peak current                        50 mA min / 70 mA max

  Input ripple                        ≤50 mV peak

  Input noise                         ≤100 mV peak

  ESD                                 ±200/±2K V and ±4K/±8K V as
                                      specified

  Output interfaces                   PWM, UART Auto, UART Controlled,
                                      Switch, RS232, RS485

  Applications                        Horizontal distance sensing, object
                                      proximity/presence awareness, dam
                                      water level monitoring
  -----------------------------------------------------------------------

## Available models

  Interface         Model
  ----------------- -------------------
  PWM               DYP-A16NYMW-V1.0
  UART Auto         DYP-A16NYUW-V1.0
  UART Controlled   DYP-A16NYTW-V1.0
  Switch output     DYP-A16NYGDW-V1.0
  RS232             DYP-A16NY2W-V1.0
  RS485             DYP-A16NY4W-V1.0

------------------------------------------------------------------------

# Source Page Mapping

    PDF page Content
  ---------- ---------------------------------------------------------------
           1 Cover --- A16 Series Sensor Module
           2 Table of Contents
           3 Product Description: General, Features, Applications
           4 Module Specification: Operating Specification and Environment
           5 Environment, Electronics, Sensor Selection Instruction
           6 Sensor model selection and Beam Pattern
           7 Reliable Testing Instruction and Notice
           8 Mechanics: Mechanical Dimensions and Parts Description
           9 Pin Out

------------------------------------------------------------------------

## Transcription / fidelity note

This Markdown version is intended as a **complete textual transcription
of the datasheet**, including specifications, tables, notes, model
numbers, test conditions, mechanical dimensions, pin assignments, and
the textual information surrounding the beam-pattern diagrams.

The source PDF contains graphical drawings/curves that do not provide
every plotted point as numeric data. Those graphics are therefore
represented by their documented test conditions, axes/ranges, and
accompanying descriptions rather than by invented numeric measurements.
