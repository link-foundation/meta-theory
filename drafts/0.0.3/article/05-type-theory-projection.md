### Проекция теории связей в теорию типов (Rocq и Lean) через теорию множеств

#### О Rocq

[Rocq](https://rocq-prover.org/) (ранее известный как [Coq](https://ru.wikipedia.org/wiki/Coq)) — это интерактивное средство доказательства теорем, основанное на теории типов высшего порядка, также известной как Исчисление Индуктивных Построений (Calculus of Inductive Constructions, CIC). Это мощная среда для формализации сложных математических теорем, проверки доказательств на корректность и извлечения работающего программного кода из формально проверенных спецификаций. Rocq широко используется в академических кругах для формализации математики, а также в IT-индустрии для верификации программного обеспечения и оборудования.

Решение применить Rocq для описания теории связей в рамках теории типов было обусловлено необходимостью строгой формализации доказательств и гарантирования логической корректности в рамках разработки теории связей. Использование Rocq позволяет выразить свойства и операции над связями в точных и надёжных терминах, благодаря системе типов Rocq и мощным средствам для создания и проверки доказательств.

В преддверии обширной работы по доказательству эквивалентности реляционной модели и сети дуплетов, мы представляем в этом разделе начальные шаги, выполненные с использованием систем доказательств Rocq и Lean. На первом этапе стоит задача формализации структур сетей через определения базовых типов, функций и структур.

#### О Lean

[Lean](https://lean-lang.org/) — это функциональный язык программирования и интерактивное средство доказательства теорем, разработанное в Microsoft Research. Lean 4, текущая версия, сочетает в себе мощную систему зависимых типов с полноценным языком программирования, что позволяет использовать один и тот же язык как для написания доказательств, так и для исполняемого кода. Lean широко применяется в проектах по формализации математики, таких как Mathlib — крупнейшая библиотека формализованных математических теорем.

Использование Lean в дополнение к Rocq позволяет обеспечить более широкую верифицируемость теории связей, а также делает формализацию доступной для более широкой аудитории математиков и разработчиков, знакомых с экосистемой Lean.

#### Определения сетей

##### Rocq

[[Ссылка на исходный код (Rocq)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/rocq/NetworkDefinitions.v)

```rocq
Require Import PeanoNat.
Require Import Coq.Init.Nat.
Require Import Vector.
Require Import List.
Require Import Coq.Init.Datatypes.
Import ListNotations.
Import VectorNotations.

(* Ссылка (Reference) — уникальный идентификатор кортежа: R ⊆ ℕ₀ *)
Definition Reference := nat.

(* Значение Reference по умолчанию: ноль *)
Definition ReferenceDefault : Reference := 0.

(* Множество кортежей ссылок длины n ∈ ℕ₀: TupleOfReferences ⊆ Rⁿ *)
Definition TupleOfReferences (n : nat) := t Reference n.

(* Значение TupleOfReferences по умолчанию *)
Definition TupleOfReferencesDefault (n : nat) : TupleOfReferences n := Vector.const ReferenceDefault n.

(* Множество всех связей: Link = Reference × TupleOfReferences *)
Definition Link (n : nat) := prod Reference (TupleOfReferences n).

(* Сеть кортежей длины n (или n-мерная сеть) из семейства функций {Nⁿ : Reference → TupleOfReferences} *)
Definition NetworkTupleFunction (n : nat) := Reference -> TupleOfReferences n.

(* Сеть кортежей длины n (или n-мерная сеть) в виде последовательности *)
Definition NetworkTupleList (n : nat) := list (TupleOfReferences n).

(* Вложенные упорядоченные пары *)
Definition ReferenceList := list Reference.

(* Сеть вложенных упорядоченных пар: N^{list} : Reference → ReferenceList *)
Definition NetworkReferenceListFunction := Reference -> ReferenceList.

(* Сеть вложенных упорядоченных пар в виде последовательности вложенных упорядоченных пар *)
Definition NetworkReferenceListList := list ReferenceList.

(* Дуплет ссылок *)
Definition Duplet := prod Reference Reference.

(* Значение Duplet по умолчанию: пара из двух ReferenceDefault, используется для обозначения пустого дуплета *)
Definition DupletDefault : Duplet := (ReferenceDefault, ReferenceDefault).

(* Сеть дуплетов (или двумерная сеть): N² : Reference → Reference² *)
Definition NetworkDupletFunction := Reference -> Duplet.

(* Сеть дуплетов (или двумерная сеть) в виде последовательности дуплетов *)
Definition NetworkDupletList := list Duplet.
```

##### Lean

[[Ссылка на исходный код (Lean)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/lean/NetworkDefinitions.lean)

```lean
-- Ссылка (Reference) — уникальный идентификатор кортежа: R ⊆ ℕ₀
abbrev Reference := Nat

-- Значение Reference по умолчанию: ноль
def ReferenceDefault : Reference := 0

-- Множество кортежей ссылок длины n ∈ ℕ₀: TupleOfReferences ⊆ Rⁿ
abbrev TupleOfReferences (n : Nat) := Vector Reference n

-- Значение TupleOfReferences по умолчанию
def TupleOfReferencesDefault (n : Nat) : TupleOfReferences n := Vector.replicate n ReferenceDefault

-- Вложенные упорядоченные пары
abbrev ReferenceList := List Reference

-- Сеть вложенных упорядоченных пар: N^{list} : Reference → ReferenceList
abbrev NetworkReferenceListFunction := Reference → ReferenceList

-- Сеть вложенных упорядоченных пар в виде последовательности вложенных упорядоченных пар
abbrev NetworkReferenceListList := List ReferenceList

-- Множество всех связей: Link = Reference × TupleOfReferences
abbrev Link (n : Nat) := Reference × TupleOfReferences n

-- Сеть кортежей длины n (или n-мерная сеть) из семейства функций {Nⁿ : Reference → TupleOfReferences}
abbrev NetworkTupleFunction (n : Nat) := Reference → TupleOfReferences n

-- Сеть кортежей длины n (или n-мерная сеть) в виде последовательности
abbrev NetworkTupleList (n : Nat) := List (TupleOfReferences n)

-- Дуплет ссылок
abbrev Duplet := Reference × Reference

-- Значение Duplet по умолчанию: пара из двух ReferenceDefault, используется для обозначения пустого дуплета
def DupletDefault : Duplet := (ReferenceDefault, ReferenceDefault)

-- Сеть дуплетов (или двумерная сеть): N² : Reference → Reference²
abbrev NetworkDupletFunction := Reference → Duplet

-- Сеть дуплетов (или двумерная сеть) в виде последовательности дуплетов
abbrev NetworkDupletList := List Duplet
```

#### Функции преобразования сетей

##### Rocq

[[Ссылка на исходный код (Rocq)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/rocq/NetworkConversions.v)

```rocq
(* Функция преобразования TupleOfReferences в ReferenceList *)
Fixpoint TupleOfReferencesToReferenceList {n : nat} (v : TupleOfReferences n) : ReferenceList :=
  match v with
  | Vector.nil _ => List.nil
  | Vector.cons _ h _ t => List.cons h (TupleOfReferencesToReferenceList t)
  end.

(* Функция преобразования NetworkTupleFunction в NetworkReferenceListFunction *)
Definition TupleFunctionToReferenceListFunction {n : nat} (a: NetworkTupleFunction n) : NetworkReferenceListFunction :=
  fun id => TupleOfReferencesToReferenceList (a id).

(* Функция преобразования NetworkTupleList в NetworkReferenceListList *)
Definition TupleListToReferenceListList {n: nat} (net: NetworkTupleList n) : NetworkReferenceListList :=
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

(* Функция преобразования NetworkReferenceListFunction в NetworkTupleFunction *)
Definition ReferenceListFunctionToTupleFunction { n: nat } (net: NetworkReferenceListFunction) : NetworkTupleFunction n :=
  fun id => match ReferenceListToTupleOfReferencesOption n (net id) with
  | Some t => t
  | None => TupleOfReferencesDefault n
  end.

(* Функция преобразования NetworkReferenceListList в NetworkTupleList *)
Definition ReferenceListListToTupleList {n: nat} (net : NetworkReferenceListList) : NetworkTupleList n :=
  map (ReferenceListToTupleOfReferencesn) net.

(* Функция преобразования ReferenceList в NetworkDupletList со смещением индексации *)
Fixpoint ReferenceListToDupletList_ (offset: nat) (np: ReferenceList) : NetworkDupletList :=
  match np with
  | nil => nil
  | cons h nil => cons (h, offset) nil
  | cons h t => cons (h, S offset) (ReferenceListToDupletList_ (S offset) t)
  end.

(* Функция преобразования ReferenceList в NetworkDupletList *)
Definition ReferenceListToDupletList (np: ReferenceList) : NetworkDupletList := ReferenceListToDupletList_ 0 np.

(* Функция добавления ReferenceList в хвост NetworkDupletList *)
Definition AddReferenceListToDupletList (anet: NetworkDupletList) (np: ReferenceList) : NetworkDupletList :=
  app anet (ReferenceListToDupletList_ (length anet) np).

(* Функция отрезает голову anetd и возвращает хвост начиная с offset *)
Fixpoint DupletListBehead (anet: NetworkDupletList) (offset : nat) : NetworkDupletList :=
  match offset with
  | 0 => anet
  | S n' =>
  match anet with
  | nil => nil
  | cons h t => DupletListBehead t n'
  end
  end.

(* Функция преобразования NetworkDupletList в ReferenceList с индексацией в начале NetworkDupletList начиная с offset *)
Fixpoint DupletListToReferenceList_ (anet: NetworkDupletList) (offset: nat) (index: nat): ReferenceList :=
  match anet with
  | nil => nil
  | cons (x, next_index) tail_anet =>
  if offset =? index then
  cons x (DupletListToReferenceList_ tail_anet (S offset) next_index)
  else
  DupletListToReferenceList_ tail_anet (S offset) index
  end.

(* Функция чтения ReferenceList из NetworkDupletList по индексу дуплета *)
Definition DupletListReadReferenceList (anet: NetworkDupletList) (index: nat) : ReferenceList :=
  DupletListToReferenceList_ anet 0 index.

(* Функция преобразования NetworkDupletList в ReferenceList начиная с головы списка сети *)
Definition DupletListToReferenceList (anet: NetworkDupletList) : ReferenceList := DupletListReadReferenceList anet 0.

(*
  Теперь всё готово для преобразования сети вложенных упорядоченных пар N^{list} : Reference → ReferenceList
  в сеть дуплетов N² : Reference → Reference².

  Данное преобразование можно делать по-разному: с сохранением исходных ссылок на кортежи
  либо с переиндексацией. Переиндексацию можно не делать, если написать дополнительную функцию для
  сети дуплетов, которая возвращает вложенную упорядоченную пару по её ссылке.
*)

(* Функция добавления NetworkReferenceListList в NetworkDupletList *)
Fixpoint AddReferenceListListToDupletList (anetd: NetworkDupletList) (anetl: NetworkReferenceListList) : NetworkDupletList :=
  match anetl with
  | nil => anetd
  | cons h t => AddReferenceListListToDupletList (AddReferenceListToDupletList anetd h) t
  end.

(* Функция преобразования NetworkReferenceListList в NetworkDupletList *)
Definition ReferenceListListToDupletList (anetl: NetworkReferenceListList) : NetworkDupletList :=
  match anetl with
  | nil => nil
  | cons h t => AddReferenceListListToDupletList (ReferenceListToDupletList h) t
  end.

(* Функция поиска ReferenceList в хвосте NetworkDupletList начинающемуся с offset по её порядковому номеру.
   Возвращает offset ReferenceList. *)
Fixpoint DupletListOffsetReferenceList_ (anet: NetworkDupletList) (offset: nat) (index: nat) : nat :=
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

(* Функция поиска ReferenceList в NetworkDupletList по её порядковому номеру. Возвращает offset ReferenceList. *)
Definition DupletListOffsetReferenceList (anet: NetworkDupletList) (index: nat) : nat :=
  DupletListOffsetReferenceList_ anet 0 index.

(* Функция преобразования NetworkTupleList в NetworkDupletList *)
Definition TupleListToDupletList {n : nat} (anetv: NetworkTupleList n) : NetworkDupletList :=
  ReferenceListListToDupletList (TupleListToReferenceListList anetv).

(*
  Теперь всё готово для преобразования сети дуплетов N² : Reference → Reference²
  в сеть вложенных упорядоченных пар N^{list} : Reference → ReferenceList.

  Данное преобразование будем делать с сохранением исходных ссылок на кортежи.
  Переиндексацию можно не делать, потому что есть функция DupletListOffsetReferenceList для
  сети дуплетов, которая возвращает смещение вложенной УП по ссылке на неё.
*)

(* Функция отрезает первую ReferenceList из NetworkDupletList и возвращает хвост *)
Fixpoint DupletListBeheadReferenceList (anet: NetworkDupletList) (offset: nat) : NetworkDupletList :=
  match anet with
  | nil => nil
  | cons (_, next_index) tail_anet =>
  if offset =? next_index then (* конец ReferenceList *)
  tail_anet
  else (* ещё не конец ReferenceList *)
  DupletListBeheadReferenceList tail_anet (S offset)
  end.

(* Функция преобразования ReferenceList и NetworkDupletList со смещения offset в NetworkReferenceListList *)
Fixpoint DupletListToReferenceListList_ (anetd: NetworkDupletList) (np: ReferenceList) (offset: nat) : NetworkReferenceListList :=
  match anetd with
  | nil => nil (* отбрасываем ReferenceList даже если она недостроена *)
  | cons (x, next_index) tail_anet =>
  if offset =? next_index then (* конец ReferenceList, переходим к следующей ReferenceList *)
  cons (app np (cons x nil)) (DupletListToReferenceListList_ tail_anet nil (S offset))
  else (* ещё не конец ReferenceList, парсим сеть дуплетов дальше *)
  DupletListToReferenceListList_ tail_anet (app np (cons x nil)) (S offset)
  end.

(* Функция преобразования NetworkDupletList в NetworkReferenceListList *)
Definition DupletListToReferenceListList (anetd: NetworkDupletList) : NetworkReferenceListList :=
  DupletListToReferenceListList_ anetd nil ReferenceDefault.
```

##### Lean

[[Ссылка на исходный код (Lean)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/lean/NetworkConversions.lean)

```lean
-- Функция преобразования TupleOfReferences в ReferenceList
def TupleOfReferencesToReferenceList {n : Nat} (v : TupleOfReferences n) : ReferenceList :=
  v.toList

-- Функция преобразования NetworkTupleFunction в NetworkReferenceListFunction
def TupleFunctionToReferenceListFunction {n : Nat} (a : NetworkTupleFunction n) : NetworkReferenceListFunction :=
  fun id => TupleOfReferencesToReferenceList (a id)

-- Функция преобразования NetworkTupleList в NetworkReferenceListList
def TupleListToReferenceListList {n : Nat} (net : NetworkTupleList n) : NetworkReferenceListList :=
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

-- Функция преобразования NetworkReferenceListFunction в NetworkTupleFunction
def ReferenceListFunctionToTupleFunction {n : Nat} (net : NetworkReferenceListFunction) : NetworkTupleFunction n :=
  fun id => match ReferenceListToTupleOfReferencesOption n (net id) with
  | some t => t
  | none => TupleOfReferencesDefault n

-- Функция преобразования NetworkReferenceListList в NetworkTupleList
def ReferenceListListToTupleList {n : Nat} (net : NetworkReferenceListList) : NetworkTupleList n :=
  net.map (ReferenceListToTupleOfReferencesn)

-- Функция преобразования ReferenceList в NetworkDupletList со смещением индексации
def ReferenceListToDupletList_ (offset : Nat) : ReferenceList → NetworkDupletList
  | [] => []
  | [h] => [(h, offset)]
  | h :: t => (h, offset + 1) :: ReferenceListToDupletList_ (offset + 1) t

-- Функция преобразования ReferenceList в NetworkDupletList
def ReferenceListToDupletList (np : ReferenceList) : NetworkDupletList :=
  ReferenceListToDupletList_ 0 np

-- Функция добавления ReferenceList в хвост NetworkDupletList
def AddReferenceListToDupletList (anet : NetworkDupletList) (np : ReferenceList) : NetworkDupletList :=
  anet ++ ReferenceListToDupletList_ anet.length np

-- Функция отрезает голову anetd и возвращает хвост начиная с offset
def DupletListBehead (anet : NetworkDupletList) : Nat → NetworkDupletList
  | 0 => anet
  | Nat.succ n => match anet with
    | [] => []
    | _ :: t => DupletListBehead t n

-- Функция преобразования NetworkDupletList в ReferenceList
def DupletListToReferenceList_ (anet : NetworkDupletList) (offset : Nat) (index : Nat) : ReferenceList :=
  match anet with
  | [] => []
  | (x, next_index) :: tail_anet =>
    if offset == index then
      x :: DupletListToReferenceList_ tail_anet (offset + 1) next_index
    else
      DupletListToReferenceList_ tail_anet (offset + 1) index

-- Функция чтения ReferenceList из NetworkDupletList по индексу дуплета
def DupletListReadReferenceList (anet : NetworkDupletList) (index : Nat) : ReferenceList :=
  DupletListToReferenceList_ anet 0 index

-- Функция преобразования NetworkDupletList в ReferenceList
def DupletListToReferenceList (anet : NetworkDupletList) : ReferenceList :=
  DupletListReadReferenceList anet 0

-- Функция добавления NetworkReferenceListList в NetworkDupletList
def AddReferenceListListToDupletList : NetworkDupletList → NetworkReferenceListList → NetworkDupletList
  | anetd, [] => anetd
  | anetd, h :: t => AddReferenceListListToDupletList (AddReferenceListToDupletList anetd h) t

-- Функция преобразования NetworkReferenceListList в NetworkDupletList
def ReferenceListListToDupletList : NetworkReferenceListList → NetworkDupletList
  | [] => []
  | h :: t => AddReferenceListListToDupletList (ReferenceListToDupletList h) t

-- Функция поиска ReferenceList по порядковому номеру. Возвращает offset ReferenceList.
def DupletListOffsetReferenceList_ (anet : NetworkDupletList) (offset : Nat) (index : Nat) : Nat :=
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

-- Функция поиска ReferenceList в NetworkDupletList по её порядковому номеру
def DupletListOffsetReferenceList (anet : NetworkDupletList) (index : Nat) : Nat :=
  DupletListOffsetReferenceList_ anet 0 index

-- Функция преобразования NetworkTupleList в NetworkDupletList
def TupleListToDupletList {n : Nat} (anetv : NetworkTupleList n) : NetworkDupletList :=
  ReferenceListListToDupletList (TupleListToReferenceListList anetv)

-- Функция отрезает первую ReferenceList из NetworkDupletList и возвращает хвост
def DupletListBeheadReferenceList (anet : NetworkDupletList) (offset : Nat) : NetworkDupletList :=
  match anet with
  | [] => []
  | (_, next_index) :: tail_anet =>
    if offset == next_index then
      tail_anet
    else
      DupletListBeheadReferenceList tail_anet (offset + 1)

-- Функция преобразования NetworkDupletList в NetworkReferenceListList
def DupletListToReferenceListList_ (anetd : NetworkDupletList) (np : ReferenceList) (offset : Nat) : NetworkReferenceListList :=
  match anetd with
  | [] => []
  | (x, next_index) :: tail_anet =>
    if offset == next_index then
      (np ++ [x]) :: DupletListToReferenceListList_ tail_anet [] (offset + 1)
    else
      DupletListToReferenceListList_ tail_anet (np ++ [x]) (offset + 1)

-- Функция преобразования NetworkDupletList в NetworkReferenceListList
def DupletListToReferenceListList (anetd : NetworkDupletList) : NetworkReferenceListList :=
  DupletListToReferenceListList_ anetd [] ReferenceDefault
```

#### Предикаты эквивалентности сетей

##### Rocq

[[Ссылка на исходный код (Rocq)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/rocq/NetworkEquivalence.v)

```rocq
(* Предикат эквивалентности двух сетей кортежей длины n,
   anet1 и anet2 типа NetworkTupleFunction.

   Данный предикат описывает свойство «эквивалентности» для таких сетей.
   Он утверждает, что anet1 и anet2 считаются «эквивалентными», если для каждой ссылки id кортеж,
   связанный с id в anet1, точно совпадает с кортежем, связанным с тем же id в anet2.
*)
Definition TupleFunctionEquivalence {n: nat} (anet1: NetworkTupleFunction n) (anet2: NetworkTupleFunction n) : Prop :=
  forall id, anet1 id = anet2 id.

(* Предикат эквивалентности двух сетей кортежей длины n,
   anet1 и anet2 типа NetworkTupleList.
*)
Definition TupleListEquivalence {n: nat} (anet1: NetworkTupleList n) (anet2: NetworkTupleList n) : Prop :=
  anet1 = anet2.

(* Предикат эквивалентности для сетей дуплетов NetworkDupletFunction *)
Definition DupletFunctionEquivalence (anet1: NetworkDupletFunction) (anet2: NetworkDupletFunction) : Prop := forall id, anet1 id = anet2 id.

(* Предикат эквивалентности для сетей дуплетов NetworkDupletList *)
Definition DupletListEquivalence (anet1: NetworkDupletList) (anet2: NetworkDupletList) : Prop := anet1 = anet2.
```

##### Lean

[[Ссылка на исходный код (Lean)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/lean/NetworkEquivalence.lean)

```lean
-- Предикат эквивалентности двух сетей кортежей длины n
def TupleFunctionEquivalence {n : Nat} (anet1 anet2 : NetworkTupleFunction n) : Prop :=
  ∀ id, anet1 id = anet2 id

-- Предикат эквивалентности двух сетей кортежей длины n в виде списков
def TupleListEquivalence {n : Nat} (anet1 anet2 : NetworkTupleList n) : Prop :=
  anet1 = anet2

-- Предикат эквивалентности для сетей дуплетов NetworkDupletFunction
def DupletFunctionEquivalence (anet1 anet2 : NetworkDupletFunction) : Prop :=
  ∀ id, anet1 id = anet2 id

-- Предикат эквивалентности для сетей дуплетов NetworkDupletList
def DupletListEquivalence (anet1 anet2 : NetworkDupletList) : Prop :=
  anet1 = anet2
```

#### Леммы эквивалентности сетей

##### Rocq

[[Ссылка на исходный код (Rocq)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/rocq/NetworkLemmas.v)

```rocq
(* Лемма о сохранении длины кортежей сети *)
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
  Теорема обёртывания и восстановления сети кортежей:

  Пусть дана сеть кортежей длины n, обозначенная как Nⁿ : Reference → Tⁿ.
  Определим операцию отображения этой сети в сеть вложенных упорядоченных пар N^{list} : Reference → ReferenceList,
  где ReferenceList = {(∅,∅) | (l, np), l ∈ Reference, np ∈ ReferenceList}.
  Затем определим обратное отображение из сети вложенных упорядоченных пар обратно
  в сеть кортежей длины n.

  Теорема утверждает:

  Для любой сети кортежей длины n, Nⁿ, применение операции преобразования
  в сеть вложенных упорядоченных пар и обратное преобразование обратно
  в сеть кортежей длины n обеспечивает восстановление исходной сети Nⁿ.
  Иначе говоря:

  ∀ Nⁿ : Reference → Tⁿ, обратно(вперёд(Nⁿ)) = Nⁿ.
*)
Theorem TupleFunctionEquivalenceAfterTransforms : forall {n: nat} (anet: NetworkTupleFunction n),
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


(* Лемма о сохранении длины списков ReferenceList в сети дуплетов *)
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

[[Ссылка на исходный код (Lean)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/lean/NetworkLemmas.lean)

```lean
-- Лемма о сохранении длины кортежей сети
theorem TupleOfReferencesDimensionPreserved {l : Nat} (t : TupleOfReferences l) :
    (TupleOfReferencesToReferenceList t).length = l := by
  simp [TupleOfReferencesToReferenceList]

-- Лемма о взаимном обращении функций ReferenceListToTupleOfReferencesOption и TupleOfReferencesToReferenceList
theorem ReferenceListToTupleOfReferencesInverse (n : Nat) (t : TupleOfReferences n) :
    ReferenceListToTupleOfReferencesOption n (TupleOfReferencesToReferenceList t) = some t := by
  simp [ReferenceListToTupleOfReferencesOption, TupleOfReferencesToReferenceList]
  congr 1

-- Теорема обёртывания и восстановления сети кортежей
theorem TupleFunctionEquivalenceAfterTransforms {n : Nat} (anet : NetworkTupleFunction n) :
    TupleFunctionEquivalence anet
      (fun id => match ReferenceListToTupleOfReferencesOption n ((TupleFunctionToReferenceListFunction anet) id) with
        | some t => t
        | none => anet id) := by
  intro id
  simp [TupleFunctionToReferenceListFunction]
  rw [ReferenceListToTupleOfReferencesInverse]

-- Лемма о сохранении длины списков ReferenceList в сети дуплетов
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

#### Примеры преобразований между сетями

##### Rocq

[[Ссылка на исходный код (Rocq)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/rocq/NetworkExamples.v)

```rocq
(* Нотация записи списков *)
Notation "{ }" := (nil) (at level 0).
Notation "{ x , .. , y }" := (cons x .. (cons y nil) ..) (at level 0).

(* Трёхмерная сеть *)
Definition complexExampleNetwork : NetworkTupleFunction 3 :=
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

(* Вычисление значений преобразованной функции трёхмерной сети *)
Compute (TupleFunctionToReferenceListFunction complexExampleNetwork) 0. (* Ожидается результат: {0, 0, 0} *)
Compute (TupleFunctionToReferenceListFunction complexExampleNetwork) 1. (* Ожидается результат: {1, 1, 2} *)
Compute (TupleFunctionToReferenceListFunction complexExampleNetwork) 2. (* Ожидается результат: {2, 4, 0} *)
Compute (TupleFunctionToReferenceListFunction complexExampleNetwork) 3. (* Ожидается результат: {3, 0, 5} *)
Compute (TupleFunctionToReferenceListFunction complexExampleNetwork) 4. (* Ожидается результат: {4, 1, 1} *)
Compute (TupleFunctionToReferenceListFunction complexExampleNetwork) 5. (* Ожидается результат: {0, 0, 0} *)

(* Сеть вложенных упорядоченных пар *)
Definition testPairsNetwork : NetworkReferenceListFunction :=
  fun id => match id with
  | 0 => {5, 0, 8}
  | 1 => {7, 1, 2}
  | 2 => {2, 4, 5}
  | 3 => {3, 1, 5}
  | 4 => {4, 2, 1}
  | S _ => {0, 0, 0}
  end.

(* Преобразованная сеть вложенных УП в трёхмерную сеть (размерность должна совпадать) *)
Definition testTuplesNetwork : NetworkTupleFunction 3 :=
  ReferenceListFunctionToTupleFunction testPairsNetwork.

(* Вычисление значений преобразованной функции сети вложенных УП *)
Compute testTuplesNetwork 0. (* Ожидается результат: [5; 0; 8] *)
Compute testTuplesNetwork 1. (* Ожидается результат: [7; 1; 2] *)
Compute testTuplesNetwork 2. (* Ожидается результат: [2; 4; 5] *)
Compute testTuplesNetwork 3. (* Ожидается результат: [3; 1; 5] *)
Compute testTuplesNetwork 4. (* Ожидается результат: [4; 2; 1] *)
Compute testTuplesNetwork 5. (* Ожидается результат: [0; 0; 0] *)

(* Преобразование вложенных УП в сеть дуплетов *)
Compute ReferenceListToDupletList { 121, 21, 1343 }.
(* Должно вернуть: {(121, 1), (21, 2), (1343, 2)} *)

(* Добавление вложенных УП в сеть дуплетов *)
Compute AddReferenceListToDupletList {(121, 1), (21, 2), (1343, 2)} {12, 23, 34}.
(* Ожидается результат: {(121, 1), (21, 2), (1343, 2), (12, 4), (23, 5), (34, 5)} *)

(* Преобразование сети дуплетов во вложенные УП *)
Compute DupletListToReferenceList {(121, 1), (21, 2), (1343, 2)}.
(* Ожидается результат: {121, 21, 1343} *)

Compute DupletListToReferenceList {(121, 1), (21, 2), (1343, 2), (12, 4), (23, 5), (34, 5)}.
(* Ожидается результат: {121, 21, 1343} *)

(* Чтение вложенных УП из сети дуплетов по индексу дуплета — начала вложенных УП *)
Compute DupletListReadReferenceList {(121, 1), (21, 2), (1343, 2), (12, 4), (23, 5), (34, 5)} 0.
(* Ожидается результат: {121, 21, 1343} *)

Compute DupletListReadReferenceList {(121, 1), (21, 2), (1343, 2), (12, 4), (23, 5), (34, 5)} 3.
(* Ожидается результат: {12, 23, 34} *)

(* Определяем сеть вложенных УП *)
Definition testReferenceListList := { {121, 21, 1343}, {12, 23}, {34}, {121, 21, 1343}, {12, 23}, {34} }.

(* Преобразованная сеть вложенных УП в сеть дуплетов *)
Definition testDupletList := ReferenceListListToDupletList testReferenceListList.

(* Вычисление преобразованной сети вложенных УП в сеть дуплетов *)
Compute testDupletList.
(* Ожидается результат:
 {(121, 1), (21, 2), (1343, 2),
  (12, 4), (23, 4),
  (34, 5),
  (121, 7), (21, 8), (1343, 8),
  (12, 10), (23, 10),
  (34, 11)} *)

(* Вычисление преобразования сети вложенных УП в сеть дуплетов и обратно в testReferenceListList *)
Compute DupletListToReferenceListList testDupletList.
(* Ожидается результат:
  {{121, 21, 1343}, {12, 23}, {34}, {121, 21, 1343}, {12, 23}, {34}} *)

(* Вычисление смещения вложенных УП в сети дуплетов по их порядковому номеру *)
Compute DupletListOffsetReferenceList testDupletList 0. (* Ожидается результат: 0 *)
Compute DupletListOffsetReferenceList testDupletList 1. (* Ожидается результат: 3 *)
Compute DupletListOffsetReferenceList testDupletList 2. (* Ожидается результат: 5 *)
Compute DupletListOffsetReferenceList testDupletList 3. (* Ожидается результат: 6 *)
Compute DupletListOffsetReferenceList testDupletList 4. (* Ожидается результат: 9 *)
Compute DupletListOffsetReferenceList testDupletList 5. (* Ожидается результат: 11 *)
Compute DupletListOffsetReferenceList testDupletList 6. (* Ожидается результат: 12 *)
Compute DupletListOffsetReferenceList testDupletList 7. (* Ожидается результат: 12 *)

(* Определяем трёхмерную сеть как последовательность кортежей длины 3 *)
Definition testTupleList : NetworkTupleList 3 :=
  { [0; 0; 0], [1; 1; 2], [2; 4; 0], [3; 0; 5], [4; 1; 1], [0; 0; 0] }.

(* Преобразованная трёхмерная сеть в сеть дуплетов через сеть вложенных УП *)
Definition testTuplesToDupletList : NetworkDupletList := TupleListToDupletList testTupleList.

(* Вычисление трёхмерной сети преобразованной в сеть дуплетов через сеть вложенных УП *)
Compute testTuplesToDupletList.
(* Ожидается результат:
{ (0, 1), (0, 2), (0, 2),
  (1, 4), (1, 5), (2, 5),
  (2, 7), (4, 8), (0, 8),
  (3, 10), (0, 11), (5, 11),
  (4, 13), (1, 14), (1, 14),
  (0, 16), (0, 17), (0, 17)} *)

(* Преобразованная трёхмерная сеть в сеть дуплетов через сеть вложенных УП и обратно в трёхмерную сеть *)
Definition resultTuplesNetwork : NetworkTupleList 3 :=
  ReferenceListListToTupleList (DupletListToReferenceListList testTuplesToDupletList).

(* Итоговая проверка эквивалентности сетей *)
Compute resultTuplesNetwork.
(* Ожидается результат:
  { [0; 0; 0], [1; 1; 2], [2; 4; 0], [3; 0; 5], [4; 1; 1], [0; 0; 0] } *)
```

##### Lean

[[Ссылка на исходный код (Lean)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/lean/NetworkExamples.lean)

```lean
-- Трёхмерная сеть
def complexExampleNetwork : NetworkTupleFunction 3 :=
  fun id => match id with
  | 0 => #v[0, 0, 0]
  | 1 => #v[1, 1, 2]
  | 2 => #v[2, 4, 0]
  | 3 => #v[3, 0, 5]
  | 4 => #v[4, 1, 1]
  | _ => #v[0, 0, 0]

-- Преобразование вложенных УП в сеть дуплетов
#eval ReferenceListToDupletList [121, 21, 1343]
-- Должно вернуть: [(121, 1), (21, 2), (1343, 2)]

-- Добавление вложенных УП в сеть дуплетов
#eval AddReferenceListToDupletList [(121, 1), (21, 2), (1343, 2)] [12, 23, 34]
-- Ожидается результат: [(121, 1), (21, 2), (1343, 2), (12, 4), (23, 5), (34, 5)]

-- Преобразование сети дуплетов во вложенные УП
#eval DupletListToReferenceList [(121, 1), (21, 2), (1343, 2)]
-- Ожидается результат: [121, 21, 1343]

-- Определяем сеть вложенных УП
def testReferenceListList : NetworkReferenceListList :=
  [[121, 21, 1343], [12, 23], [34], [121, 21, 1343], [12, 23], [34]]

-- Преобразование сети вложенных УП в сеть дуплетов и обратно
#eval DupletListToReferenceListList (ReferenceListListToDupletList testReferenceListList)
-- Ожидается результат:
-- [[121, 21, 1343], [12, 23], [34], [121, 21, 1343], [12, 23], [34]]

-- Определяем трёхмерную сеть как последовательность кортежей длины 3
def testTupleList : NetworkTupleList 3 :=
  [#v[0, 0, 0], #v[1, 1, 2], #v[2, 4, 0], #v[3, 0, 5], #v[4, 1, 1], #v[0, 0, 0]]

-- Итоговая проверка эквивалентности сетей
def resultTuplesNetwork : NetworkTupleList 3 :=
  ReferenceListListToTupleList (DupletListToReferenceListList (TupleListToDupletList testTupleList))

#eval resultTuplesNetwork.map (·.toList)
-- Ожидается результат:
-- [[0, 0, 0], [1, 1, 2], [2, 4, 0], [3, 0, 5], [4, 1, 1], [0, 0, 0]]
```
