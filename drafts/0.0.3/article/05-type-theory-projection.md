### Проекция теории связей в теорию типов (Rocq и Lean) через теорию множеств

#### О Rocq

[Rocq](https://rocq-prover.org/) (ранее известный как [Coq](https://ru.wikipedia.org/wiki/Coq)) — это интерактивное средство доказательства теорем, основанное на теории типов высшего порядка, также известной как Исчисление Индуктивных Построений (Calculus of Inductive Constructions, CIC). Это мощная среда для формализации сложных математических теорем, проверки доказательств на корректность и извлечения работающего программного кода из формально проверенных спецификаций. Rocq широко используется в академических кругах для формализации математики, а также в IT-индустрии для верификации программного обеспечения и оборудования.

Решение применить Rocq для описания теории связей в рамках теории типов было обусловлено необходимостью строгой формализации доказательств и гарантирования логической корректности в рамках разработки теории связей. Использование Rocq позволяет выразить свойства и операции над связями в точных и надёжных терминах, благодаря системе типов Rocq и мощным средствам для создания и проверки доказательств.

В преддверии обширной работы по доказательству эквивалентности реляционной модели и ассоциативной сети дуплетов, мы представляем в этом разделе начальные шаги, выполненные с использованием систем доказательств Rocq и Lean. На первом этапе стоит задача формализации структур ассоциативных сетей через определения базовых типов, функций и структур.

#### О Lean

[Lean](https://lean-lang.org/) — это функциональный язык программирования и интерактивное средство доказательства теорем, разработанное в Microsoft Research. Lean 4, текущая версия, сочетает в себе мощную систему зависимых типов с полноценным языком программирования, что позволяет использовать один и тот же язык как для написания доказательств, так и для исполняемого кода. Lean широко применяется в проектах по формализации математики, таких как Mathlib — крупнейшая библиотека формализованных математических теорем.

Использование Lean в дополнение к Rocq позволяет обеспечить более широкую верифицируемость теории связей, а также делает формализацию доступной для более широкой аудитории математиков и разработчиков, знакомых с экосистемой Lean.

#### Определения ассоциативных сетей

##### Rocq

[[Ссылка на исходный код (Rocq)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/rocq/AssociativeNetworkDefinitions.v)

```rocq
Require Import PeanoNat.
Require Import Coq.Init.Nat.
Require Import Vector.
Require Import List.
Require Import Coq.Init.Datatypes.
Import ListNotations.
Import VectorNotations.

(* Множество ссылок на кортежи: L ⊆ ℕ₀ *)
Definition Reference := nat.

(* Значение Reference по умолчанию: ноль *)
Definition ReferenceDefault : Reference := 0.

(* Множество кортежей ссылок длины n ∈ ℕ₀: TupleOfReferences ⊆ Lⁿ *)
Definition TupleOfReferences (n : nat) := t Reference n.

(* Значение TupleOfReferences по умолчанию *)
Definition TupleOfReferencesDefault (n : nat) : TupleOfReferences n := Vector.const ReferenceDefault n.

(* Множество всех ассоциаций: Association = Reference × TupleOfReferences *)
Definition Association (n : nat) := prod Reference (TupleOfReferences n).

(* Ассоциативная сеть кортежей длины n (или n-мерная ассоциативная сеть) из семейства функций {anetvⁿ : Reference → TupleOfReferences} *)
Definition AssociativeNetworkTupleFunction (n : nat) := Reference -> TupleOfReferences n.

(* Ассоциативная сеть кортежей длины n (или n-мерная ассоциативная сеть) в виде последовательности *)
Definition AssociativeNetworkTupleList (n : nat) := list (TupleOfReferences n).

(* Вложенные упорядоченные пары *)
Definition ReferenceList := list Reference.

(* Ассоциативная сеть вложенных упорядоченных пар: anetl : Reference → ReferenceList *)
Definition AssociativeNetworkReferenceListFunction := Reference -> ReferenceList.

(* Ассоциативная сеть вложенных упорядоченных пар в виде последовательности вложенных упорядоченных пар *)
Definition AssociativeNetworkReferenceListList := list ReferenceList.

(* Дуплет ссылок *)
Definition Duplet := prod Reference Reference.

(* Значение Duplet по умолчанию: пара из двух ReferenceDefault, используется для обозначения пустого дуплета *)
Definition DupletDefault : Duplet := (ReferenceDefault, ReferenceDefault).

(* Ассоциативная сеть дуплетов (или двумерная ассоциативная сеть): anetd : Reference → Reference² *)
Definition AssociativeNetworkDupletFunction := Reference -> Duplet.

(* Ассоциативная сеть дуплетов (или двумерная ассоциативная сеть) в виде последовательности дуплетов *)
Definition AssociativeNetworkDupletList := list Duplet.
```

##### Lean

[[Ссылка на исходный код (Lean)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/lean/AssociativeNetworkDefinitions.lean)

```lean
-- Множество ссылок на кортежи: L ⊆ ℕ₀
abbrev Reference := Nat

-- Значение Reference по умолчанию: ноль
def ReferenceDefault : Reference := 0

-- Множество кортежей ссылок длины n ∈ ℕ₀: TupleOfReferences ⊆ Lⁿ
abbrev TupleOfReferences (n : Nat) := Vector Reference n

-- Значение TupleOfReferences по умолчанию
def TupleOfReferencesDefault (n : Nat) : TupleOfReferences n := Vector.replicate n ReferenceDefault

-- Вложенные упорядоченные пары
abbrev ReferenceList := List Reference

-- Ассоциативная сеть вложенных упорядоченных пар: anetl : Reference → ReferenceList
abbrev AssociativeNetworkReferenceListFunction := Reference → ReferenceList

-- Ассоциативная сеть вложенных упорядоченных пар в виде последовательности вложенных упорядоченных пар
abbrev AssociativeNetworkReferenceListList := List ReferenceList

-- Множество всех ассоциаций: Association = Reference × TupleOfReferences
abbrev Association (n : Nat) := Reference × TupleOfReferences n

-- Ассоциативная сеть кортежей длины n (или n-мерная ассоциативная сеть) из семейства функций {anetvⁿ : Reference → TupleOfReferences}
abbrev AssociativeNetworkTupleFunction (n : Nat) := Reference → TupleOfReferences n

-- Ассоциативная сеть кортежей длины n (или n-мерная ассоциативная сеть) в виде последовательности
abbrev AssociativeNetworkTupleList (n : Nat) := List (TupleOfReferences n)

-- Дуплет ссылок
abbrev Duplet := Reference × Reference

-- Значение Duplet по умолчанию: пара из двух ReferenceDefault, используется для обозначения пустого дуплета
def DupletDefault : Duplet := (ReferenceDefault, ReferenceDefault)

-- Ассоциативная сеть дуплетов (или двумерная ассоциативная сеть): anetd : Reference → Reference²
abbrev AssociativeNetworkDupletFunction := Reference → Duplet

-- Ассоциативная сеть дуплетов (или двумерная ассоциативная сеть) в виде последовательности дуплетов
abbrev AssociativeNetworkDupletList := List Duplet
```

#### Функции преобразования ассоциативных сетей

##### Rocq

[[Ссылка на исходный код (Rocq)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/rocq/AssociativeNetworkConversions.v)

```rocq
(* Функция преобразования TupleOfReferences в ReferenceList *)
Fixpoint TupleOfReferencesToReferenceList {n : nat} (v : TupleOfReferences n) : ReferenceList :=
  match v with
  | Vector.nil _ => List.nil
  | Vector.cons _ h _ t => List.cons h (TupleOfReferencesToReferenceList t)
  end.

(* Функция преобразования AssociativeNetworkTupleFunction в AssociativeNetworkReferenceListFunction *)
Definition TupleFunctionToReferenceListFunction {n : nat} (a: AssociativeNetworkTupleFunction n) : AssociativeNetworkReferenceListFunction :=
  fun id => TupleOfReferencesToReferenceList (a id).

(* Функция преобразования AssociativeNetworkTupleList в AssociativeNetworkReferenceListList *)
Definition TupleListToReferenceListList {n: nat} (net: AssociativeNetworkTupleList n) : AssociativeNetworkReferenceListList :=
  map TupleOfReferencesToReferenceList net.

(* Функция преобразования ReferenceList в TupleOfReferences, возвращающая option *)
Fixpoint ReferenceListToTupleOfReferencesOption (n: nat) (p: ReferenceList) : option (TupleOfReferences n) :=
  match n, p with
  | 0, List.nil => Some (Vector.nil nat)
  | S n', List.cons f p' =>
  match ReferenceListToTupleOfReferencesOption n' p' with
  | None => None
  | Some t => Some (Vector.cons nat f n' t)
  end
  | _, _ => None
  end.

(* Функция преобразования ReferenceList в TupleOfReferences с использованием TupleOfReferencesDefault *)
Definition ReferenceListToTupleOfReferences(n: nat) (p: ReferenceList) : TupleOfReferences n :=
  match ReferenceListToTupleOfReferencesOption n p with
  | None => TupleOfReferencesDefault n
  | Some t => t
  end.

(* Функция преобразования AssociativeNetworkReferenceListFunction в AssociativeNetworkTupleFunction *)
Definition ReferenceListFunctionToTupleFunction { n: nat } (net: AssociativeNetworkReferenceListFunction) : AssociativeNetworkTupleFunction n :=
  fun id => match ReferenceListToTupleOfReferencesOption n (net id) with
  | Some t => t
  | None => TupleOfReferencesDefault n
  end.

(* Функция преобразования AssociativeNetworkReferenceListList в AssociativeNetworkTupleList *)
Definition ReferenceListListToTupleList {n: nat} (net : AssociativeNetworkReferenceListList) : AssociativeNetworkTupleList n :=
  map (ReferenceListToTupleOfReferencesn) net.

(* Функция преобразования ReferenceList в AssociativeNetworkDupletList со смещением индексации *)
Fixpoint ReferenceListToDupletList_ (offset: nat) (np: ReferenceList) : AssociativeNetworkDupletList :=
  match np with
  | nil => nil
  | cons h nil => cons (h, offset) nil
  | cons h t => cons (h, S offset) (ReferenceListToDupletList_ (S offset) t)
  end.

(* Функция преобразования ReferenceList в AssociativeNetworkDupletList *)
Definition ReferenceListToDupletList (np: ReferenceList) : AssociativeNetworkDupletList := ReferenceListToDupletList_ 0 np.

(* Функция добавления ReferenceList в хвост AssociativeNetworkDupletList *)
Definition AddReferenceListToDupletList (anet: AssociativeNetworkDupletList) (np: ReferenceList) : AssociativeNetworkDupletList :=
  app anet (ReferenceListToDupletList_ (length anet) np).

(* Функция отрезает голову anetd и возвращает хвост начиная с offset *)
Fixpoint DupletListBehead (anet: AssociativeNetworkDupletList) (offset : nat) : AssociativeNetworkDupletList :=
  match offset with
  | 0 => anet
  | S n' =>
  match anet with
  | nil => nil
  | cons h t => DupletListBehead t n'
  end
  end.

(* Функция преобразования AssociativeNetworkDupletList в ReferenceList с индексацией в начале AssociativeNetworkDupletList начиная с offset *)
Fixpoint DupletListToReferenceList_ (anet: AssociativeNetworkDupletList) (offset: nat) (index: nat): ReferenceList :=
  match anet with
  | nil => nil
  | cons (x, next_index) tail_anet =>
  if offset =? index then
  cons x (DupletListToReferenceList_ tail_anet (S offset) next_index)
  else
  DupletListToReferenceList_ tail_anet (S offset) index
  end.

(* Функция чтения ReferenceList из AssociativeNetworkDupletList по индексу дуплета *)
Definition DupletListReadReferenceList (anet: AssociativeNetworkDupletList) (index: nat) : ReferenceList :=
  DupletListToReferenceList_ anet 0 index.

(* Функция преобразования AssociativeNetworkDupletList в ReferenceList начиная с головы списка ассоциативной сети *)
Definition DupletListToReferenceList (anet: AssociativeNetworkDupletList) : ReferenceList := DupletListReadReferenceList anet 0.

(*
  Теперь всё готово для преобразования ассоциативной сети вложенных упорядоченных пар anetl : Reference → ReferenceList
  в ассоциативную сеть дуплетов anetd : Reference → Reference².

  Данное преобразование можно делать по-разному: с сохранением исходных ссылок на кортежи
  либо с переиндексацией. Переиндексацию можно не делать, если написать дополнительную функцию для
  ассоциативной сети дуплетов, которая возвращает вложенную упорядоченную пару по её ссылке.
*)

(* Функция добавления AssociativeNetworkReferenceListList в AssociativeNetworkDupletList *)
Fixpoint AddReferenceListListToDupletList (anetd: AssociativeNetworkDupletList) (anetl: AssociativeNetworkReferenceListList) : AssociativeNetworkDupletList :=
  match anetl with
  | nil => anetd
  | cons h t => AddReferenceListListToDupletList (AddReferenceListToDupletList anetd h) t
  end.

(* Функция преобразования AssociativeNetworkReferenceListList в AssociativeNetworkDupletList *)
Definition ReferenceListListToDupletList (anetl: AssociativeNetworkReferenceListList) : AssociativeNetworkDupletList :=
  match anetl with
  | nil => nil
  | cons h t => AddReferenceListListToDupletList (ReferenceListToDupletList h) t
  end.

(* Функция поиска ReferenceList в хвосте AssociativeNetworkDupletList начинающемуся с offset по её порядковому номеру.
   Возвращает offset ReferenceList. *)
Fixpoint DupletListOffsetReferenceList_ (anet: AssociativeNetworkDupletList) (offset: nat) (index: nat) : nat :=
  match anet with
  | nil => offset + (length anet)
  | cons (_, next_index) tail_anet =>
  match index with
  | O => offset
  | S index' =>
  if offset =? next_index then
  DupletListOffsetReferenceList_ tail_anet (S offset) index'
  else
  DupletListOffsetReferenceList_ tail_anet (S offset) index
  end
  end.

(* Функция поиска ReferenceList в AssociativeNetworkDupletList по её порядковому номеру. Возвращает offset ReferenceList. *)
Definition DupletListOffsetReferenceList (anet: AssociativeNetworkDupletList) (index: nat) : nat :=
  DupletListOffsetReferenceList_ anet 0 index.

(* Функция преобразования AssociativeNetworkTupleList в AssociativeNetworkDupletList *)
Definition TupleListToDupletList {n : nat} (anetv: AssociativeNetworkTupleList n) : AssociativeNetworkDupletList :=
  ReferenceListListToDupletList (TupleListToReferenceListList anetv).

(*
  Теперь всё готово для преобразования ассоциативной сети дуплетов anetd : Reference → Reference²
  в ассоциативную сеть вложенных упорядоченных пар anetl : Reference → ReferenceList.

  Данное преобразование будем делать с сохранением исходных ссылок на кортежи.
  Переиндексацию можно не делать, потому что есть функция DupletListOffsetReferenceList для
  ассоциативной сети дуплетов, которая возвращает смещение вложенной УП по ссылке на неё.
*)

(* Функция отрезает первую ReferenceList из AssociativeNetworkDupletList и возвращает хвост *)
Fixpoint DupletListBeheadReferenceList (anet: AssociativeNetworkDupletList) (offset: nat) : AssociativeNetworkDupletList :=
  match anet with
  | nil => nil
  | cons (_, next_index) tail_anet =>
  if offset =? next_index then (* конец ReferenceList *)
  tail_anet
  else (* ещё не конец ReferenceList *)
  DupletListBeheadReferenceList tail_anet (S offset)
  end.

(* Функция преобразования ReferenceList и AssociativeNetworkDupletList со смещения offset в AssociativeNetworkReferenceListList *)
Fixpoint DupletListToReferenceListList_ (anetd: AssociativeNetworkDupletList) (np: ReferenceList) (offset: nat) : AssociativeNetworkReferenceListList :=
  match anetd with
  | nil => nil (* отбрасываем ReferenceList даже если она недостроена *)
  | cons (x, next_index) tail_anet =>
  if offset =? next_index then (* конец ReferenceList, переходим к следующей ReferenceList *)
  cons (app np (cons x nil)) (DupletListToReferenceListList_ tail_anet nil (S offset))
  else (* ещё не конец ReferenceList, парсим ассоциативную сеть дуплетов дальше *)
  DupletListToReferenceListList_ tail_anet (app np (cons x nil)) (S offset)
  end.

(* Функция преобразования AssociativeNetworkDupletList в AssociativeNetworkReferenceListList *)
Definition DupletListToReferenceListList (anetd: AssociativeNetworkDupletList) : AssociativeNetworkReferenceListList :=
  DupletListToReferenceListList_ anetd nil ReferenceDefault.
```

##### Lean

[[Ссылка на исходный код (Lean)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/lean/AssociativeNetworkConversions.lean)

```lean
-- Функция преобразования TupleOfReferences в ReferenceList
def TupleOfReferencesToReferenceList {n : Nat} (v : TupleOfReferences n) : ReferenceList :=
  v.toList

-- Функция преобразования AssociativeNetworkTupleFunction в AssociativeNetworkReferenceListFunction
def TupleFunctionToReferenceListFunction {n : Nat} (a : AssociativeNetworkTupleFunction n) : AssociativeNetworkReferenceListFunction :=
  fun id => TupleOfReferencesToReferenceList (a id)

-- Функция преобразования AssociativeNetworkTupleList в AssociativeNetworkReferenceListList
def TupleListToReferenceListList {n : Nat} (net : AssociativeNetworkTupleList n) : AssociativeNetworkReferenceListList :=
  net.map TupleOfReferencesToReferenceList

-- Функция преобразования ReferenceList в TupleOfReferences, возвращающая option
def ReferenceListToTupleOfReferencesOption (n : Nat) (p : ReferenceList) : Option (TupleOfReferences n) :=
  let arr := p.toArray
  if h : arr.size = n then
    some ⟨arr, h⟩
  else
    none

-- Функция преобразования ReferenceList в TupleOfReferences с использованием TupleOfReferencesDefault
def ReferenceListToTupleOfReferences(n : Nat) (p : ReferenceList) : TupleOfReferences n :=
  match ReferenceListToTupleOfReferencesOption n p with
  | none => TupleOfReferencesDefault n
  | some t => t

-- Функция преобразования AssociativeNetworkReferenceListFunction в AssociativeNetworkTupleFunction
def ReferenceListFunctionToTupleFunction {n : Nat} (net : AssociativeNetworkReferenceListFunction) : AssociativeNetworkTupleFunction n :=
  fun id => match ReferenceListToTupleOfReferencesOption n (net id) with
  | some t => t
  | none => TupleOfReferencesDefault n

-- Функция преобразования AssociativeNetworkReferenceListList в AssociativeNetworkTupleList
def ReferenceListListToTupleList {n : Nat} (net : AssociativeNetworkReferenceListList) : AssociativeNetworkTupleList n :=
  net.map (ReferenceListToTupleOfReferencesn)

-- Функция преобразования ReferenceList в AssociativeNetworkDupletList со смещением индексации
def ReferenceListToDupletList_ (offset : Nat) : ReferenceList → AssociativeNetworkDupletList
  | [] => []
  | [h] => [(h, offset)]
  | h :: t => (h, offset + 1) :: ReferenceListToDupletList_ (offset + 1) t

-- Функция преобразования ReferenceList в AssociativeNetworkDupletList
def ReferenceListToDupletList (np : ReferenceList) : AssociativeNetworkDupletList :=
  ReferenceListToDupletList_ 0 np

-- Функция добавления ReferenceList в хвост AssociativeNetworkDupletList
def AddReferenceListToDupletList (anet : AssociativeNetworkDupletList) (np : ReferenceList) : AssociativeNetworkDupletList :=
  anet ++ ReferenceListToDupletList_ anet.length np

-- Функция отрезает голову anetd и возвращает хвост начиная с offset
def DupletListBehead (anet : AssociativeNetworkDupletList) : Nat → AssociativeNetworkDupletList
  | 0 => anet
  | Nat.succ n => match anet with
    | [] => []
    | _ :: t => DupletListBehead t n

-- Функция преобразования AssociativeNetworkDupletList в ReferenceList
def DupletListToReferenceList_ (anet : AssociativeNetworkDupletList) (offset : Nat) (index : Nat) : ReferenceList :=
  match anet with
  | [] => []
  | (x, next_index) :: tail_anet =>
    if offset == index then
      x :: DupletListToReferenceList_ tail_anet (offset + 1) next_index
    else
      DupletListToReferenceList_ tail_anet (offset + 1) index

-- Функция чтения ReferenceList из AssociativeNetworkDupletList по индексу дуплета
def DupletListReadReferenceList (anet : AssociativeNetworkDupletList) (index : Nat) : ReferenceList :=
  DupletListToReferenceList_ anet 0 index

-- Функция преобразования AssociativeNetworkDupletList в ReferenceList
def DupletListToReferenceList (anet : AssociativeNetworkDupletList) : ReferenceList :=
  DupletListReadReferenceList anet 0

-- Функция добавления AssociativeNetworkReferenceListList в AssociativeNetworkDupletList
def AddReferenceListListToDupletList : AssociativeNetworkDupletList → AssociativeNetworkReferenceListList → AssociativeNetworkDupletList
  | anetd, [] => anetd
  | anetd, h :: t => AddReferenceListListToDupletList (AddReferenceListToDupletList anetd h) t

-- Функция преобразования AssociativeNetworkReferenceListList в AssociativeNetworkDupletList
def ReferenceListListToDupletList : AssociativeNetworkReferenceListList → AssociativeNetworkDupletList
  | [] => []
  | h :: t => AddReferenceListListToDupletList (ReferenceListToDupletList h) t

-- Функция поиска ReferenceList по порядковому номеру. Возвращает offset ReferenceList.
def DupletListOffsetReferenceList_ (anet : AssociativeNetworkDupletList) (offset : Nat) (index : Nat) : Nat :=
  match anet with
  | [] => offset + anet.length
  | (_, next_index) :: tail_anet =>
    match index with
    | 0 => offset
    | Nat.succ index' =>
      if offset == next_index then
        DupletListOffsetReferenceList_ tail_anet (offset + 1) index'
      else
        DupletListOffsetReferenceList_ tail_anet (offset + 1) index

-- Функция поиска ReferenceList в AssociativeNetworkDupletList по её порядковому номеру
def DupletListOffsetReferenceList (anet : AssociativeNetworkDupletList) (index : Nat) : Nat :=
  DupletListOffsetReferenceList_ anet 0 index

-- Функция преобразования AssociativeNetworkTupleList в AssociativeNetworkDupletList
def TupleListToDupletList {n : Nat} (anetv : AssociativeNetworkTupleList n) : AssociativeNetworkDupletList :=
  ReferenceListListToDupletList (TupleListToReferenceListList anetv)

-- Функция отрезает первую ReferenceList из AssociativeNetworkDupletList и возвращает хвост
def DupletListBeheadReferenceList (anet : AssociativeNetworkDupletList) (offset : Nat) : AssociativeNetworkDupletList :=
  match anet with
  | [] => []
  | (_, next_index) :: tail_anet =>
    if offset == next_index then
      tail_anet
    else
      DupletListBeheadReferenceList tail_anet (offset + 1)

-- Функция преобразования AssociativeNetworkDupletList в AssociativeNetworkReferenceListList
def DupletListToReferenceListList_ (anetd : AssociativeNetworkDupletList) (np : ReferenceList) (offset : Nat) : AssociativeNetworkReferenceListList :=
  match anetd with
  | [] => []
  | (x, next_index) :: tail_anet =>
    if offset == next_index then
      (np ++ [x]) :: DupletListToReferenceListList_ tail_anet [] (offset + 1)
    else
      DupletListToReferenceListList_ tail_anet (np ++ [x]) (offset + 1)

-- Функция преобразования AssociativeNetworkDupletList в AssociativeNetworkReferenceListList
def DupletListToReferenceListList (anetd : AssociativeNetworkDupletList) : AssociativeNetworkReferenceListList :=
  DupletListToReferenceListList_ anetd [] ReferenceDefault
```

#### Предикаты эквивалентности ассоциативных сетей

##### Rocq

[[Ссылка на исходный код (Rocq)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/rocq/AssociativeNetworkEquivalence.v)

```rocq
(* Предикат эквивалентности двух ассоциативных сетей кортежей длины n,
   anet1 и anet2 типа AssociativeNetworkTupleFunction.

   Данный предикат описывает свойство «эквивалентности» для таких сетей.
   Он утверждает, что anet1 и anet2 считаются «эквивалентными», если для каждой ссылки id кортеж,
   связанный с id в anet1, точно совпадает с кортежем, связанным с тем же id в anet2.
*)
Definition TupleFunctionEquivalence {n: nat} (anet1: AssociativeNetworkTupleFunction n) (anet2: AssociativeNetworkTupleFunction n) : Prop :=
  forall id, anet1 id = anet2 id.

(* Предикат эквивалентности двух ассоциативных сетей кортежей длины n,
   anet1 и anet2 типа AssociativeNetworkTupleList.
*)
Definition TupleListEquivalence {n: nat} (anet1: AssociativeNetworkTupleList n) (anet2: AssociativeNetworkTupleList n) : Prop :=
  anet1 = anet2.

(* Предикат эквивалентности для ассоциативных сетей дуплетов AssociativeNetworkDupletFunction *)
Definition DupletFunctionEquivalence (anet1: AssociativeNetworkDupletFunction) (anet2: AssociativeNetworkDupletFunction) : Prop := forall id, anet1 id = anet2 id.

(* Предикат эквивалентности для ассоциативных сетей дуплетов AssociativeNetworkDupletList *)
Definition DupletListEquivalence (anet1: AssociativeNetworkDupletList) (anet2: AssociativeNetworkDupletList) : Prop := anet1 = anet2.
```

##### Lean

[[Ссылка на исходный код (Lean)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/lean/AssociativeNetworkEquivalence.lean)

```lean
-- Предикат эквивалентности двух ассоциативных сетей кортежей длины n
def TupleFunctionEquivalence {n : Nat} (anet1 anet2 : AssociativeNetworkTupleFunction n) : Prop :=
  ∀ id, anet1 id = anet2 id

-- Предикат эквивалентности двух ассоциативных сетей кортежей длины n в виде списков
def TupleListEquivalence {n : Nat} (anet1 anet2 : AssociativeNetworkTupleList n) : Prop :=
  anet1 = anet2

-- Предикат эквивалентности для ассоциативных сетей дуплетов AssociativeNetworkDupletFunction
def DupletFunctionEquivalence (anet1 anet2 : AssociativeNetworkDupletFunction) : Prop :=
  ∀ id, anet1 id = anet2 id

-- Предикат эквивалентности для ассоциативных сетей дуплетов AssociativeNetworkDupletList
def DupletListEquivalence (anet1 anet2 : AssociativeNetworkDupletList) : Prop :=
  anet1 = anet2
```

#### Леммы эквивалентности ассоциативных сетей

##### Rocq

[[Ссылка на исходный код (Rocq)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/rocq/AssociativeNetworkLemmas.v)

```rocq
(* Лемма о сохранении длины кортежей ассоциативной сети *)
Lemma TupleOfReferencesDimensionPreserved : forall {l: nat} (t: TupleOfReferences l), List.length (TupleOfReferencesToReferenceList t) = l.
Proof.
  intros l t.
  induction t.
  - simpl. reflexivity.
  - simpl. rewrite IHt. reflexivity.
Qed.


(* Лемма о взаимном обращении функций ReferenceListToTupleOfReferencesOption и TupleOfReferencesToReferenceList

   ReferenceListToTupleOfReferencesInverse доказывает, что каждый кортеж TupleOfReferences без потери данных может быть преобразован в ReferenceList
   с помощью TupleOfReferencesToReferenceList и обратно в TupleOfReferences с помощью ReferenceListToTupleOfReferencesOption.

   В формальном виде forall n: nat, forall t: TupleOfReferences n, ReferenceListToTupleOfReferencesOption n (TupleOfReferencesToReferenceList t) = Some t говорит о том,
   что для всякого натурального числа n и каждого кортежа TupleOfReferences длины n,
   мы можем преобразовать TupleOfReferences в ReferenceList с помощью TupleOfReferencesToReferenceList,
   затем обратно преобразовать результат в TupleOfReferences с помощью ReferenceListToTupleOfReferencesOption n,
   и в итоге получить тот же кортеж TupleOfReferences, что и в начале.

   Это свойство очень важно, потому что оно гарантирует,
   что эти две функции образуют обратную пару на множестве преобразуемых кортежей TupleOfReferences и ReferenceList.
   Когда вы применяете обе функции к значениям в этом множестве, вы в итоге получаете исходное значение.
   Это означает, что никакая информация не теряется при преобразованиях,
   так что можно свободно конвертировать между TupleOfReferences и ReferenceList,
   если это требуется в реализации или доказательствах.
*)
Lemma ReferenceListToTupleOfReferencesInverse: forall n: nat, forall t: TupleOfReferences n, ReferenceListToTupleOfReferencesOption n (TupleOfReferencesToReferenceList t) = Some t.
Proof.
  intros n.
  induction t as [| h n' t' IH].
  - simpl. reflexivity.
  - simpl. rewrite IH. reflexivity.
Qed.


(*
  Теорема обёртывания и восстановления ассоциативной сети кортежей:

  Пусть дана ассоциативная сеть кортежей длины n, обозначенная как anetvⁿ : Reference → Tⁿ.
  Определим операцию отображения этой сети в ассоциативную сеть вложенных упорядоченных пар anetl : Reference → ReferenceList,
  где ReferenceList = {(∅,∅) | (l, np), l ∈ Reference, np ∈ ReferenceList}.
  Затем определим обратное отображение из ассоциативной сети вложенных упорядоченных пар обратно
  в ассоциативную сеть кортежей длины n.

  Теорема утверждает:

  Для любой ассоциативной сети кортежей длины n, anetvⁿ, применение операции преобразования
  в ассоциативную сеть вложенных упорядоченных пар и обратное преобразование обратно
  в ассоциативную сеть кортежей длины n обеспечивает восстановление исходной сети anetvⁿ.
  Иначе говоря:

  ∀ anetvⁿ : Reference → Tⁿ, обратно(вперёд(anetvⁿ)) = anetvⁿ.
*)
Theorem TupleFunctionEquivalenceAfterTransforms : forall {n: nat} (anet: AssociativeNetworkTupleFunction n),
  TupleFunctionEquivalence anet (fun id => match ReferenceListToTupleOfReferencesOption n ((TupleFunctionToReferenceListFunction anet) id) with
  | Some t => t
  | None => anet id
  end).
Proof.
  intros n net id.
  unfold TupleFunctionToReferenceListFunction.
  simpl.
  rewrite ReferenceListToTupleOfReferencesInverse.
  reflexivity.
Qed.


(* Лемма о сохранении длины списков ReferenceList в ассоциативной сети дуплетов *)
Lemma ReferenceListDimensionPreserved : forall (offset: nat) (np: ReferenceList),
  length np = length (ReferenceListToDupletList_ offset np).
Proof.
  intros offset np.
  generalize dependent offset.
  induction np as [| n np' IHnp']; intros offset.
  - simpl. reflexivity.
  - destruct np' as [| m np'']; simpl; simpl in IHnp'.
  + reflexivity.
  + rewrite IHnp' with (offset := S offset). reflexivity.
Qed.
```

##### Lean

[[Ссылка на исходный код (Lean)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/lean/AssociativeNetworkLemmas.lean)

```lean
-- Лемма о сохранении длины кортежей ассоциативной сети
theorem TupleOfReferencesDimensionPreserved {l : Nat} (t : TupleOfReferences l) :
    (TupleOfReferencesToReferenceList t).length = l := by
  simp [TupleOfReferencesToReferenceList]

-- Лемма о взаимном обращении функций ReferenceListToTupleOfReferencesOption и TupleOfReferencesToReferenceList
theorem ReferenceListToTupleOfReferencesInverse (n : Nat) (t : TupleOfReferences n) :
    ReferenceListToTupleOfReferencesOption n (TupleOfReferencesToReferenceList t) = some t := by
  simp [ReferenceListToTupleOfReferencesOption, TupleOfReferencesToReferenceList]
  congr 1

-- Теорема обёртывания и восстановления ассоциативной сети кортежей
theorem TupleFunctionEquivalenceAfterTransforms {n : Nat} (anet : AssociativeNetworkTupleFunction n) :
    TupleFunctionEquivalence anet
      (fun id => match ReferenceListToTupleOfReferencesOption n ((TupleFunctionToReferenceListFunction anet) id) with
        | some t => t
        | none => anet id) := by
  intro id
  simp [TupleFunctionToReferenceListFunction]
  rw [ReferenceListToTupleOfReferencesInverse]

-- Лемма о сохранении длины списков ReferenceList в ассоциативной сети дуплетов
theorem ReferenceListDimensionPreserved (offset : Nat) (np : ReferenceList) :
    np.length = (ReferenceListToDupletList_ offset np).length := by
  induction np generalizing offset with
  | nil => simp [ReferenceListToDupletList_]
  | cons n np' ih =>
    cases np' with
    | nil => simp [ReferenceListToDupletList_]
    | cons m np'' =>
      simp [ReferenceListToDupletList_]
      exact ih (offset + 1)
```

#### Примеры преобразований между ассоциативными сетями

##### Rocq

[[Ссылка на исходный код (Rocq)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/rocq/AssociativeNetworkExamples.v)

```rocq
(* Нотация записи списков *)
Notation "{ }" := (nil) (at level 0).
Notation "{ x , .. , y }" := (cons x .. (cons y nil) ..) (at level 0).

(* Трёхмерная ассоциативная сеть *)
Definition complexExampleNetwork : AssociativeNetworkTupleFunction 3 :=
  fun id => match id with
  | 0 => [0; 0; 0]
  | 1 => [1; 1; 2]
  | 2 => [2; 4; 0]
  | 3 => [3; 0; 5]
  | 4 => [4; 1; 1]
  | S _ => [0; 0; 0]
  end.

(* Кортежи ссылок *)
Definition exampleTuple0 : TupleOfReferences 0 := [].
Definition exampleTuple1 : TupleOfReferences 1 := [0].
Definition exampleTuple4 : TupleOfReferences 4 := [3; 2; 1; 0].

(* Преобразование кортежей ссылок во вложенные упорядоченные пары (списки) *)
Definition nestedPair0 := TupleOfReferencesToReferenceList exampleTuple0.
Definition nestedPair1 := TupleOfReferencesToReferenceList exampleTuple1.
Definition nestedPair4 := TupleOfReferencesToReferenceList exampleTuple4.

Compute nestedPair0. (* Ожидается результат: { } *)
Compute nestedPair1. (* Ожидается результат: {0} *)
Compute nestedPair4. (* Ожидается результат: {3, 2, 1, 0} *)

(* Вычисление значений преобразованной функции трёхмерной ассоциативной сети *)
Compute (TupleFunctionToReferenceListFunction complexExampleNetwork) 0. (* Ожидается результат: {0, 0, 0} *)
Compute (TupleFunctionToReferenceListFunction complexExampleNetwork) 1. (* Ожидается результат: {1, 1, 2} *)
Compute (TupleFunctionToReferenceListFunction complexExampleNetwork) 2. (* Ожидается результат: {2, 4, 0} *)
Compute (TupleFunctionToReferenceListFunction complexExampleNetwork) 3. (* Ожидается результат: {3, 0, 5} *)
Compute (TupleFunctionToReferenceListFunction complexExampleNetwork) 4. (* Ожидается результат: {4, 1, 1} *)
Compute (TupleFunctionToReferenceListFunction complexExampleNetwork) 5. (* Ожидается результат: {0, 0, 0} *)

(* Ассоциативная сеть вложенных упорядоченных пар *)
Definition testPairsNetwork : AssociativeNetworkReferenceListFunction :=
  fun id => match id with
  | 0 => {5, 0, 8}
  | 1 => {7, 1, 2}
  | 2 => {2, 4, 5}
  | 3 => {3, 1, 5}
  | 4 => {4, 2, 1}
  | S _ => {0, 0, 0}
  end.

(* Преобразованная ассоциативная сеть вложенных УП в трёхмерную ассоциативную сеть (размерность должна совпадать) *)
Definition testTuplesNetwork : AssociativeNetworkTupleFunction 3 :=
  ReferenceListFunctionToTupleFunction testPairsNetwork.

(* Вычисление значений преобразованной функции ассоциативной сети вложенных УП *)
Compute testTuplesNetwork 0. (* Ожидается результат: [5; 0; 8] *)
Compute testTuplesNetwork 1. (* Ожидается результат: [7; 1; 2] *)
Compute testTuplesNetwork 2. (* Ожидается результат: [2; 4; 5] *)
Compute testTuplesNetwork 3. (* Ожидается результат: [3; 1; 5] *)
Compute testTuplesNetwork 4. (* Ожидается результат: [4; 2; 1] *)
Compute testTuplesNetwork 5. (* Ожидается результат: [0; 0; 0] *)

(* Преобразование вложенных УП в ассоциативную сеть дуплетов *)
Compute ReferenceListToDupletList { 121, 21, 1343 }.
(* Должно вернуть: {(121, 1), (21, 2), (1343, 2)} *)

(* Добавление вложенных УП в ассоциативную сеть дуплетов *)
Compute AddReferenceListToDupletList {(121, 1), (21, 2), (1343, 2)} {12, 23, 34}.
(* Ожидается результат: {(121, 1), (21, 2), (1343, 2), (12, 4), (23, 5), (34, 5)} *)

(* Преобразование ассоциативной сети дуплетов во вложенные УП *)
Compute DupletListToReferenceList {(121, 1), (21, 2), (1343, 2)}.
(* Ожидается результат: {121, 21, 1343} *)

Compute DupletListToReferenceList {(121, 1), (21, 2), (1343, 2), (12, 4), (23, 5), (34, 5)}.
(* Ожидается результат: {121, 21, 1343} *)

(* Чтение вложенных УП из ассоциативной сети дуплетов по индексу дуплета — начала вложенных УП *)
Compute DupletListReadReferenceList {(121, 1), (21, 2), (1343, 2), (12, 4), (23, 5), (34, 5)} 0.
(* Ожидается результат: {121, 21, 1343} *)

Compute DupletListReadReferenceList {(121, 1), (21, 2), (1343, 2), (12, 4), (23, 5), (34, 5)} 3.
(* Ожидается результат: {12, 23, 34} *)

(* Определяем ассоциативную сеть вложенных УП *)
Definition testReferenceListList := { {121, 21, 1343}, {12, 23}, {34}, {121, 21, 1343}, {12, 23}, {34} }.

(* Преобразованная ассоциативная сеть вложенных УП в ассоциативную сеть дуплетов *)
Definition testDupletList := ReferenceListListToDupletList testReferenceListList.

(* Вычисление преобразованной ассоциативной сети вложенных УП в ассоциативную сеть дуплетов *)
Compute testDupletList.
(* Ожидается результат:
 {(121, 1), (21, 2), (1343, 2),
  (12, 4), (23, 4),
  (34, 5),
  (121, 7), (21, 8), (1343, 8),
  (12, 10), (23, 10),
  (34, 11)} *)

(* Вычисление преобразования ассоциативной сети вложенных УП в ассоциативную сеть дуплетов и обратно в testReferenceListList *)
Compute DupletListToReferenceListList testDupletList.
(* Ожидается результат:
  {{121, 21, 1343}, {12, 23}, {34}, {121, 21, 1343}, {12, 23}, {34}} *)

(* Вычисление смещения вложенных УП в ассоциативной сети дуплетов по их порядковому номеру *)
Compute DupletListOffsetReferenceList testDupletList 0. (* Ожидается результат: 0 *)
Compute DupletListOffsetReferenceList testDupletList 1. (* Ожидается результат: 3 *)
Compute DupletListOffsetReferenceList testDupletList 2. (* Ожидается результат: 5 *)
Compute DupletListOffsetReferenceList testDupletList 3. (* Ожидается результат: 6 *)
Compute DupletListOffsetReferenceList testDupletList 4. (* Ожидается результат: 9 *)
Compute DupletListOffsetReferenceList testDupletList 5. (* Ожидается результат: 11 *)
Compute DupletListOffsetReferenceList testDupletList 6. (* Ожидается результат: 12 *)
Compute DupletListOffsetReferenceList testDupletList 7. (* Ожидается результат: 12 *)

(* Определяем трёхмерную ассоциативную сеть как последовательность кортежей длины 3 *)
Definition testTupleList : AssociativeNetworkTupleList 3 :=
  { [0; 0; 0], [1; 1; 2], [2; 4; 0], [3; 0; 5], [4; 1; 1], [0; 0; 0] }.

(* Преобразованная трёхмерная ассоциативная сеть в ассоциативную сеть дуплетов через ассоциативную сеть вложенных УП *)
Definition testTuplesToDupletList : AssociativeNetworkDupletList := TupleListToDupletList testTupleList.

(* Вычисление трёхмерной ассоциативной сети преобразованной в ассоциативную сеть дуплетов через ассоциативную сеть вложенных УП *)
Compute testTuplesToDupletList.
(* Ожидается результат:
{ (0, 1), (0, 2), (0, 2),
  (1, 4), (1, 5), (2, 5),
  (2, 7), (4, 8), (0, 8),
  (3, 10), (0, 11), (5, 11),
  (4, 13), (1, 14), (1, 14),
  (0, 16), (0, 17), (0, 17)} *)

(* Преобразованная трёхмерная ассоциативная сеть в ассоциативную сеть дуплетов через ассоциативную сеть вложенных УП и обратно в трёхмерную ассоциативную сеть *)
Definition resultTuplesNetwork : AssociativeNetworkTupleList 3 :=
  ReferenceListListToTupleList (DupletListToReferenceListList testTuplesToDupletList).

(* Итоговая проверка эквивалентности ассоциативных сетей *)
Compute resultTuplesNetwork.
(* Ожидается результат:
  { [0; 0; 0], [1; 1; 2], [2; 4; 0], [3; 0; 5], [4; 1; 1], [0; 0; 0] } *)
```

##### Lean

[[Ссылка на исходный код (Lean)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/lean/AssociativeNetworkExamples.lean)

```lean
-- Трёхмерная ассоциативная сеть
def complexExampleNetwork : AssociativeNetworkTupleFunction 3 :=
  fun id => match id with
  | 0 => #v[0, 0, 0]
  | 1 => #v[1, 1, 2]
  | 2 => #v[2, 4, 0]
  | 3 => #v[3, 0, 5]
  | 4 => #v[4, 1, 1]
  | _ => #v[0, 0, 0]

-- Преобразование вложенных УП в ассоциативную сеть дуплетов
#eval ReferenceListToDupletList [121, 21, 1343]
-- Должно вернуть: [(121, 1), (21, 2), (1343, 2)]

-- Добавление вложенных УП в ассоциативную сеть дуплетов
#eval AddReferenceListToDupletList [(121, 1), (21, 2), (1343, 2)] [12, 23, 34]
-- Ожидается результат: [(121, 1), (21, 2), (1343, 2), (12, 4), (23, 5), (34, 5)]

-- Преобразование ассоциативной сети дуплетов во вложенные УП
#eval DupletListToReferenceList [(121, 1), (21, 2), (1343, 2)]
-- Ожидается результат: [121, 21, 1343]

-- Определяем ассоциативную сеть вложенных УП
def testReferenceListList : AssociativeNetworkReferenceListList :=
  [[121, 21, 1343], [12, 23], [34], [121, 21, 1343], [12, 23], [34]]

-- Преобразование ассоциативной сети вложенных УП в ассоциативную сеть дуплетов и обратно
#eval DupletListToReferenceListList (ReferenceListListToDupletList testReferenceListList)
-- Ожидается результат:
-- [[121, 21, 1343], [12, 23], [34], [121, 21, 1343], [12, 23], [34]]

-- Определяем трёхмерную ассоциативную сеть как последовательность кортежей длины 3
def testTupleList : AssociativeNetworkTupleList 3 :=
  [#v[0, 0, 0], #v[1, 1, 2], #v[2, 4, 0], #v[3, 0, 5], #v[4, 1, 1], #v[0, 0, 0]]

-- Итоговая проверка эквивалентности ассоциативных сетей
def resultTuplesNetwork : AssociativeNetworkTupleList 3 :=
  ReferenceListListToTupleList (DupletListToReferenceListList (TupleListToDupletList testTupleList))

#eval resultTuplesNetwork.map (·.toList)
-- Ожидается результат:
-- [[0, 0, 0], [1, 1, 2], [2, 4, 0], [3, 0, 5], [4, 1, 1], [0, 0, 0]]
```
