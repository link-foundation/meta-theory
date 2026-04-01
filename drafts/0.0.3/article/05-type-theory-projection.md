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
Definition Link := nat.

(* Значение Link по умолчанию: ноль *)
Definition LinkDefault : Link := 0.

(* Множество кортежей ссылок длины n ∈ ℕ₀: TupleOfLinks ⊆ Lⁿ *)
Definition TupleOfLinks (n : nat) := t Link n.

(* Значение TupleOfLinks по умолчанию *)
Definition TupleOfLinksDefault (n : nat) : TupleOfLinks n := Vector.const LinkDefault n.

(* Множество всех ассоциаций: Association = Link × TupleOfLinks *)
Definition Association (n : nat) := prod Link (TupleOfLinks n).

(* Ассоциативная сеть кортежей длины n (или n-мерная ассоциативная сеть) из семейства функций {anetvⁿ : Link → TupleOfLinks} *)
Definition AssociativeNetworkTupleFunction (n : nat) := Link -> TupleOfLinks n.

(* Ассоциативная сеть кортежей длины n (или n-мерная ассоциативная сеть) в виде последовательности *)
Definition AssociativeNetworkTupleList (n : nat) := list (TupleOfLinks n).

(* Вложенные упорядоченные пары *)
Definition LinkList := list Link.

(* Ассоциативная сеть вложенных упорядоченных пар: anetl : Link → LinkList *)
Definition AssociativeNetworkLinkListFunction := Link -> LinkList.

(* Ассоциативная сеть вложенных упорядоченных пар в виде последовательности вложенных упорядоченных пар *)
Definition AssociativeNetworkLinkListList := list LinkList.

(* Дуплет ссылок *)
Definition Duplet := prod Link Link.

(* Значение Duplet по умолчанию: пара из двух LinkDefault, используется для обозначения пустого дуплета *)
Definition DupletDefault : Duplet := (LinkDefault, LinkDefault).

(* Ассоциативная сеть дуплетов (или двумерная ассоциативная сеть): anetd : Link → Link² *)
Definition AssociativeNetworkDupletFunction := Link -> Duplet.

(* Ассоциативная сеть дуплетов (или двумерная ассоциативная сеть) в виде последовательности дуплетов *)
Definition AssociativeNetworkDupletList := list Duplet.
```

##### Lean

[[Ссылка на исходный код (Lean)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/lean/AssociativeNetworkDefinitions.lean)

```lean
-- Множество ссылок на кортежи: L ⊆ ℕ₀
abbrev Link := Nat

-- Значение Link по умолчанию: ноль
def LinkDefault : Link := 0

-- Множество кортежей ссылок длины n ∈ ℕ₀: TupleOfLinks ⊆ Lⁿ
abbrev TupleOfLinks (n : Nat) := Vector Link n

-- Значение TupleOfLinks по умолчанию
def TupleOfLinksDefault (n : Nat) : TupleOfLinks n := Vector.replicate n LinkDefault

-- Вложенные упорядоченные пары
abbrev LinkList := List Link

-- Ассоциативная сеть вложенных упорядоченных пар: anetl : Link → LinkList
abbrev AssociativeNetworkLinkListFunction := Link → LinkList

-- Ассоциативная сеть вложенных упорядоченных пар в виде последовательности вложенных упорядоченных пар
abbrev AssociativeNetworkLinkListList := List LinkList

-- Множество всех ассоциаций: Association = Link × TupleOfLinks
abbrev Association (n : Nat) := Link × TupleOfLinks n

-- Ассоциативная сеть кортежей длины n (или n-мерная ассоциативная сеть) из семейства функций {anetvⁿ : Link → TupleOfLinks}
abbrev AssociativeNetworkTupleFunction (n : Nat) := Link → TupleOfLinks n

-- Ассоциативная сеть кортежей длины n (или n-мерная ассоциативная сеть) в виде последовательности
abbrev AssociativeNetworkTupleList (n : Nat) := List (TupleOfLinks n)

-- Дуплет ссылок
abbrev Duplet := Link × Link

-- Значение Duplet по умолчанию: пара из двух LinkDefault, используется для обозначения пустого дуплета
def DupletDefault : Duplet := (LinkDefault, LinkDefault)

-- Ассоциативная сеть дуплетов (или двумерная ассоциативная сеть): anetd : Link → Link²
abbrev AssociativeNetworkDupletFunction := Link → Duplet

-- Ассоциативная сеть дуплетов (или двумерная ассоциативная сеть) в виде последовательности дуплетов
abbrev AssociativeNetworkDupletList := List Duplet
```

#### Функции преобразования ассоциативных сетей

##### Rocq

[[Ссылка на исходный код (Rocq)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/rocq/AssociativeNetworkConversions.v)

```rocq
(* Функция преобразования TupleOfLinks в LinkList *)
Fixpoint TupleOfLinksToLinkList {n : nat} (v : TupleOfLinks n) : LinkList :=
  match v with
  | Vector.nil _ => List.nil
  | Vector.cons _ h _ t => List.cons h (TupleOfLinksToLinkList t)
  end.

(* Функция преобразования AssociativeNetworkTupleFunction в AssociativeNetworkLinkListFunction *)
Definition TupleFunctionToLinkListFunction {n : nat} (a: AssociativeNetworkTupleFunction n) : AssociativeNetworkLinkListFunction :=
  fun id => TupleOfLinksToLinkList (a id).

(* Функция преобразования AssociativeNetworkTupleList в AssociativeNetworkLinkListList *)
Definition TupleListToLinkListList {n: nat} (net: AssociativeNetworkTupleList n) : AssociativeNetworkLinkListList :=
  map TupleOfLinksToLinkList net.

(* Функция преобразования LinkList в TupleOfLinks, возвращающая option *)
Fixpoint LinkListToTupleOfLinksOption (n: nat) (p: LinkList) : option (TupleOfLinks n) :=
  match n, p with
  | 0, List.nil => Some (Vector.nil nat)
  | S n', List.cons f p' =>
  match LinkListToTupleOfLinksOption n' p' with
  | None => None
  | Some t => Some (Vector.cons nat f n' t)
  end
  | _, _ => None
  end.

(* Функция преобразования LinkList в TupleOfLinks с использованием TupleOfLinksDefault *)
Definition LinkListToTupleOfLinks (n: nat) (p: LinkList) : TupleOfLinks n :=
  match LinkListToTupleOfLinksOption n p with
  | None => TupleOfLinksDefault n
  | Some t => t
  end.

(* Функция преобразования AssociativeNetworkLinkListFunction в AssociativeNetworkTupleFunction *)
Definition LinkListFunctionToTupleFunction { n: nat } (net: AssociativeNetworkLinkListFunction) : AssociativeNetworkTupleFunction n :=
  fun id => match LinkListToTupleOfLinksOption n (net id) with
  | Some t => t
  | None => TupleOfLinksDefault n
  end.

(* Функция преобразования AssociativeNetworkLinkListList в AssociativeNetworkTupleList *)
Definition LinkListListToTupleList {n: nat} (net : AssociativeNetworkLinkListList) : AssociativeNetworkTupleList n :=
  map (LinkListToTupleOfLinks n) net.

(* Функция преобразования LinkList в AssociativeNetworkDupletList со смещением индексации *)
Fixpoint LinkListToDupletList_ (offset: nat) (np: LinkList) : AssociativeNetworkDupletList :=
  match np with
  | nil => nil
  | cons h nil => cons (h, offset) nil
  | cons h t => cons (h, S offset) (LinkListToDupletList_ (S offset) t)
  end.

(* Функция преобразования LinkList в AssociativeNetworkDupletList *)
Definition LinkListToDupletList (np: LinkList) : AssociativeNetworkDupletList := LinkListToDupletList_ 0 np.

(* Функция добавления LinkList в хвост AssociativeNetworkDupletList *)
Definition AddLinkListToDupletList (anet: AssociativeNetworkDupletList) (np: LinkList) : AssociativeNetworkDupletList :=
  app anet (LinkListToDupletList_ (length anet) np).

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

(* Функция преобразования AssociativeNetworkDupletList в LinkList с индексацией в начале AssociativeNetworkDupletList начиная с offset *)
Fixpoint DupletListToLinkList_ (anet: AssociativeNetworkDupletList) (offset: nat) (index: nat): LinkList :=
  match anet with
  | nil => nil
  | cons (x, next_index) tail_anet =>
  if offset =? index then
  cons x (DupletListToLinkList_ tail_anet (S offset) next_index)
  else
  DupletListToLinkList_ tail_anet (S offset) index
  end.

(* Функция чтения LinkList из AssociativeNetworkDupletList по индексу дуплета *)
Definition DupletListReadLinkList (anet: AssociativeNetworkDupletList) (index: nat) : LinkList :=
  DupletListToLinkList_ anet 0 index.

(* Функция преобразования AssociativeNetworkDupletList в LinkList начиная с головы списка ассоциативной сети *)
Definition DupletListToLinkList (anet: AssociativeNetworkDupletList) : LinkList := DupletListReadLinkList anet 0.

(*
  Теперь всё готово для преобразования ассоциативной сети вложенных упорядоченных пар anetl : Link → LinkList
  в ассоциативную сеть дуплетов anetd : Link → Link².

  Данное преобразование можно делать по-разному: с сохранением исходных ссылок на кортежи
  либо с переиндексацией. Переиндексацию можно не делать, если написать дополнительную функцию для
  ассоциативной сети дуплетов, которая возвращает вложенную упорядоченную пару по её ссылке.
*)

(* Функция добавления AssociativeNetworkLinkListList в AssociativeNetworkDupletList *)
Fixpoint AddLinkListListToDupletList (anetd: AssociativeNetworkDupletList) (anetl: AssociativeNetworkLinkListList) : AssociativeNetworkDupletList :=
  match anetl with
  | nil => anetd
  | cons h t => AddLinkListListToDupletList (AddLinkListToDupletList anetd h) t
  end.

(* Функция преобразования AssociativeNetworkLinkListList в AssociativeNetworkDupletList *)
Definition LinkListListToDupletList (anetl: AssociativeNetworkLinkListList) : AssociativeNetworkDupletList :=
  match anetl with
  | nil => nil
  | cons h t => AddLinkListListToDupletList (LinkListToDupletList h) t
  end.

(* Функция поиска LinkList в хвосте AssociativeNetworkDupletList начинающемуся с offset по её порядковому номеру.
   Возвращает offset LinkList. *)
Fixpoint DupletListOffsetLinkList_ (anet: AssociativeNetworkDupletList) (offset: nat) (index: nat) : nat :=
  match anet with
  | nil => offset + (length anet)
  | cons (_, next_index) tail_anet =>
  match index with
  | O => offset
  | S index' =>
  if offset =? next_index then
  DupletListOffsetLinkList_ tail_anet (S offset) index'
  else
  DupletListOffsetLinkList_ tail_anet (S offset) index
  end
  end.

(* Функция поиска LinkList в AssociativeNetworkDupletList по её порядковому номеру. Возвращает offset LinkList. *)
Definition DupletListOffsetLinkList (anet: AssociativeNetworkDupletList) (index: nat) : nat :=
  DupletListOffsetLinkList_ anet 0 index.

(* Функция преобразования AssociativeNetworkTupleList в AssociativeNetworkDupletList *)
Definition TupleListToDupletList {n : nat} (anetv: AssociativeNetworkTupleList n) : AssociativeNetworkDupletList :=
  LinkListListToDupletList (TupleListToLinkListList anetv).

(*
  Теперь всё готово для преобразования ассоциативной сети дуплетов anetd : Link → Link²
  в ассоциативную сеть вложенных упорядоченных пар anetl : Link → LinkList.

  Данное преобразование будем делать с сохранением исходных ссылок на кортежи.
  Переиндексацию можно не делать, потому что есть функция DupletListOffsetLinkList для
  ассоциативной сети дуплетов, которая возвращает смещение вложенной УП по ссылке на неё.
*)

(* Функция отрезает первую LinkList из AssociativeNetworkDupletList и возвращает хвост *)
Fixpoint DupletListBeheadLinkList (anet: AssociativeNetworkDupletList) (offset: nat) : AssociativeNetworkDupletList :=
  match anet with
  | nil => nil
  | cons (_, next_index) tail_anet =>
  if offset =? next_index then (* конец LinkList *)
  tail_anet
  else (* ещё не конец LinkList *)
  DupletListBeheadLinkList tail_anet (S offset)
  end.

(* Функция преобразования LinkList и AssociativeNetworkDupletList со смещения offset в AssociativeNetworkLinkListList *)
Fixpoint DupletListToLinkListList_ (anetd: AssociativeNetworkDupletList) (np: LinkList) (offset: nat) : AssociativeNetworkLinkListList :=
  match anetd with
  | nil => nil (* отбрасываем LinkList даже если она недостроена *)
  | cons (x, next_index) tail_anet =>
  if offset =? next_index then (* конец LinkList, переходим к следующей LinkList *)
  cons (app np (cons x nil)) (DupletListToLinkListList_ tail_anet nil (S offset))
  else (* ещё не конец LinkList, парсим ассоциативную сеть дуплетов дальше *)
  DupletListToLinkListList_ tail_anet (app np (cons x nil)) (S offset)
  end.

(* Функция преобразования AssociativeNetworkDupletList в AssociativeNetworkLinkListList *)
Definition DupletListToLinkListList (anetd: AssociativeNetworkDupletList) : AssociativeNetworkLinkListList :=
  DupletListToLinkListList_ anetd nil LinkDefault.
```

##### Lean

[[Ссылка на исходный код (Lean)]](https://github.com/link-foundation/meta-theory/blob/main/drafts/0.0.3/src/lean/AssociativeNetworkConversions.lean)

```lean
-- Функция преобразования TupleOfLinks в LinkList
def TupleOfLinksToLinkList {n : Nat} (v : TupleOfLinks n) : LinkList :=
  v.toList

-- Функция преобразования AssociativeNetworkTupleFunction в AssociativeNetworkLinkListFunction
def TupleFunctionToLinkListFunction {n : Nat} (a : AssociativeNetworkTupleFunction n) : AssociativeNetworkLinkListFunction :=
  fun id => TupleOfLinksToLinkList (a id)

-- Функция преобразования AssociativeNetworkTupleList в AssociativeNetworkLinkListList
def TupleListToLinkListList {n : Nat} (net : AssociativeNetworkTupleList n) : AssociativeNetworkLinkListList :=
  net.map TupleOfLinksToLinkList

-- Функция преобразования LinkList в TupleOfLinks, возвращающая option
def LinkListToTupleOfLinksOption (n : Nat) (p : LinkList) : Option (TupleOfLinks n) :=
  let arr := p.toArray
  if h : arr.size = n then
    some ⟨arr, h⟩
  else
    none

-- Функция преобразования LinkList в TupleOfLinks с использованием TupleOfLinksDefault
def LinkListToTupleOfLinks (n : Nat) (p : LinkList) : TupleOfLinks n :=
  match LinkListToTupleOfLinksOption n p with
  | none => TupleOfLinksDefault n
  | some t => t

-- Функция преобразования AssociativeNetworkLinkListFunction в AssociativeNetworkTupleFunction
def LinkListFunctionToTupleFunction {n : Nat} (net : AssociativeNetworkLinkListFunction) : AssociativeNetworkTupleFunction n :=
  fun id => match LinkListToTupleOfLinksOption n (net id) with
  | some t => t
  | none => TupleOfLinksDefault n

-- Функция преобразования AssociativeNetworkLinkListList в AssociativeNetworkTupleList
def LinkListListToTupleList {n : Nat} (net : AssociativeNetworkLinkListList) : AssociativeNetworkTupleList n :=
  net.map (LinkListToTupleOfLinks n)

-- Функция преобразования LinkList в AssociativeNetworkDupletList со смещением индексации
def LinkListToDupletList_ (offset : Nat) : LinkList → AssociativeNetworkDupletList
  | [] => []
  | [h] => [(h, offset)]
  | h :: t => (h, offset + 1) :: LinkListToDupletList_ (offset + 1) t

-- Функция преобразования LinkList в AssociativeNetworkDupletList
def LinkListToDupletList (np : LinkList) : AssociativeNetworkDupletList :=
  LinkListToDupletList_ 0 np

-- Функция добавления LinkList в хвост AssociativeNetworkDupletList
def AddLinkListToDupletList (anet : AssociativeNetworkDupletList) (np : LinkList) : AssociativeNetworkDupletList :=
  anet ++ LinkListToDupletList_ anet.length np

-- Функция отрезает голову anetd и возвращает хвост начиная с offset
def DupletListBehead (anet : AssociativeNetworkDupletList) : Nat → AssociativeNetworkDupletList
  | 0 => anet
  | Nat.succ n => match anet with
    | [] => []
    | _ :: t => DupletListBehead t n

-- Функция преобразования AssociativeNetworkDupletList в LinkList
def DupletListToLinkList_ (anet : AssociativeNetworkDupletList) (offset : Nat) (index : Nat) : LinkList :=
  match anet with
  | [] => []
  | (x, next_index) :: tail_anet =>
    if offset == index then
      x :: DupletListToLinkList_ tail_anet (offset + 1) next_index
    else
      DupletListToLinkList_ tail_anet (offset + 1) index

-- Функция чтения LinkList из AssociativeNetworkDupletList по индексу дуплета
def DupletListReadLinkList (anet : AssociativeNetworkDupletList) (index : Nat) : LinkList :=
  DupletListToLinkList_ anet 0 index

-- Функция преобразования AssociativeNetworkDupletList в LinkList
def DupletListToLinkList (anet : AssociativeNetworkDupletList) : LinkList :=
  DupletListReadLinkList anet 0

-- Функция добавления AssociativeNetworkLinkListList в AssociativeNetworkDupletList
def AddLinkListListToDupletList : AssociativeNetworkDupletList → AssociativeNetworkLinkListList → AssociativeNetworkDupletList
  | anetd, [] => anetd
  | anetd, h :: t => AddLinkListListToDupletList (AddLinkListToDupletList anetd h) t

-- Функция преобразования AssociativeNetworkLinkListList в AssociativeNetworkDupletList
def LinkListListToDupletList : AssociativeNetworkLinkListList → AssociativeNetworkDupletList
  | [] => []
  | h :: t => AddLinkListListToDupletList (LinkListToDupletList h) t

-- Функция поиска LinkList по порядковому номеру. Возвращает offset LinkList.
def DupletListOffsetLinkList_ (anet : AssociativeNetworkDupletList) (offset : Nat) (index : Nat) : Nat :=
  match anet with
  | [] => offset + anet.length
  | (_, next_index) :: tail_anet =>
    match index with
    | 0 => offset
    | Nat.succ index' =>
      if offset == next_index then
        DupletListOffsetLinkList_ tail_anet (offset + 1) index'
      else
        DupletListOffsetLinkList_ tail_anet (offset + 1) index

-- Функция поиска LinkList в AssociativeNetworkDupletList по её порядковому номеру
def DupletListOffsetLinkList (anet : AssociativeNetworkDupletList) (index : Nat) : Nat :=
  DupletListOffsetLinkList_ anet 0 index

-- Функция преобразования AssociativeNetworkTupleList в AssociativeNetworkDupletList
def TupleListToDupletList {n : Nat} (anetv : AssociativeNetworkTupleList n) : AssociativeNetworkDupletList :=
  LinkListListToDupletList (TupleListToLinkListList anetv)

-- Функция отрезает первую LinkList из AssociativeNetworkDupletList и возвращает хвост
def DupletListBeheadLinkList (anet : AssociativeNetworkDupletList) (offset : Nat) : AssociativeNetworkDupletList :=
  match anet with
  | [] => []
  | (_, next_index) :: tail_anet =>
    if offset == next_index then
      tail_anet
    else
      DupletListBeheadLinkList tail_anet (offset + 1)

-- Функция преобразования AssociativeNetworkDupletList в AssociativeNetworkLinkListList
def DupletListToLinkListList_ (anetd : AssociativeNetworkDupletList) (np : LinkList) (offset : Nat) : AssociativeNetworkLinkListList :=
  match anetd with
  | [] => []
  | (x, next_index) :: tail_anet =>
    if offset == next_index then
      (np ++ [x]) :: DupletListToLinkListList_ tail_anet [] (offset + 1)
    else
      DupletListToLinkListList_ tail_anet (np ++ [x]) (offset + 1)

-- Функция преобразования AssociativeNetworkDupletList в AssociativeNetworkLinkListList
def DupletListToLinkListList (anetd : AssociativeNetworkDupletList) : AssociativeNetworkLinkListList :=
  DupletListToLinkListList_ anetd [] LinkDefault
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
Lemma TupleOfLinksDimensionPreserved : forall {l: nat} (t: TupleOfLinks l), List.length (TupleOfLinksToLinkList t) = l.
Proof.
  intros l t.
  induction t.
  - simpl. reflexivity.
  - simpl. rewrite IHt. reflexivity.
Qed.


(* Лемма о взаимном обращении функций LinkListToTupleOfLinksOption и TupleOfLinksToLinkList

   LinkListToTupleOfLinksInverse доказывает, что каждый кортеж TupleOfLinks без потери данных может быть преобразован в LinkList
   с помощью TupleOfLinksToLinkList и обратно в TupleOfLinks с помощью LinkListToTupleOfLinksOption.

   В формальном виде forall n: nat, forall t: TupleOfLinks n, LinkListToTupleOfLinksOption n (TupleOfLinksToLinkList t) = Some t говорит о том,
   что для всякого натурального числа n и каждого кортежа TupleOfLinks длины n,
   мы можем преобразовать TupleOfLinks в LinkList с помощью TupleOfLinksToLinkList,
   затем обратно преобразовать результат в TupleOfLinks с помощью LinkListToTupleOfLinksOption n,
   и в итоге получить тот же кортеж TupleOfLinks, что и в начале.

   Это свойство очень важно, потому что оно гарантирует,
   что эти две функции образуют обратную пару на множестве преобразуемых кортежей TupleOfLinks и LinkList.
   Когда вы применяете обе функции к значениям в этом множестве, вы в итоге получаете исходное значение.
   Это означает, что никакая информация не теряется при преобразованиях,
   так что можно свободно конвертировать между TupleOfLinks и LinkList,
   если это требуется в реализации или доказательствах.
*)
Lemma LinkListToTupleOfLinksInverse: forall n: nat, forall t: TupleOfLinks n, LinkListToTupleOfLinksOption n (TupleOfLinksToLinkList t) = Some t.
Proof.
  intros n.
  induction t as [| h n' t' IH].
  - simpl. reflexivity.
  - simpl. rewrite IH. reflexivity.
Qed.


(*
  Теорема обёртывания и восстановления ассоциативной сети кортежей:

  Пусть дана ассоциативная сеть кортежей длины n, обозначенная как anetvⁿ : Link → Tⁿ.
  Определим операцию отображения этой сети в ассоциативную сеть вложенных упорядоченных пар anetl : Link → LinkList,
  где LinkList = {(∅,∅) | (l, np), l ∈ Link, np ∈ LinkList}.
  Затем определим обратное отображение из ассоциативной сети вложенных упорядоченных пар обратно
  в ассоциативную сеть кортежей длины n.

  Теорема утверждает:

  Для любой ассоциативной сети кортежей длины n, anetvⁿ, применение операции преобразования
  в ассоциативную сеть вложенных упорядоченных пар и обратное преобразование обратно
  в ассоциативную сеть кортежей длины n обеспечивает восстановление исходной сети anetvⁿ.
  Иначе говоря:

  ∀ anetvⁿ : Link → Tⁿ, обратно(вперёд(anetvⁿ)) = anetvⁿ.
*)
Theorem TupleFunctionEquivalenceAfterTransforms : forall {n: nat} (anet: AssociativeNetworkTupleFunction n),
  TupleFunctionEquivalence anet (fun id => match LinkListToTupleOfLinksOption n ((TupleFunctionToLinkListFunction anet) id) with
  | Some t => t
  | None => anet id
  end).
Proof.
  intros n net id.
  unfold TupleFunctionToLinkListFunction.
  simpl.
  rewrite LinkListToTupleOfLinksInverse.
  reflexivity.
Qed.


(* Лемма о сохранении длины списков LinkList в ассоциативной сети дуплетов *)
Lemma LinkListDimensionPreserved : forall (offset: nat) (np: LinkList),
  length np = length (LinkListToDupletList_ offset np).
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
theorem TupleOfLinksDimensionPreserved {l : Nat} (t : TupleOfLinks l) :
    (TupleOfLinksToLinkList t).length = l := by
  simp [TupleOfLinksToLinkList]

-- Лемма о взаимном обращении функций LinkListToTupleOfLinksOption и TupleOfLinksToLinkList
theorem LinkListToTupleOfLinksInverse (n : Nat) (t : TupleOfLinks n) :
    LinkListToTupleOfLinksOption n (TupleOfLinksToLinkList t) = some t := by
  simp [LinkListToTupleOfLinksOption, TupleOfLinksToLinkList]
  congr 1

-- Теорема обёртывания и восстановления ассоциативной сети кортежей
theorem TupleFunctionEquivalenceAfterTransforms {n : Nat} (anet : AssociativeNetworkTupleFunction n) :
    TupleFunctionEquivalence anet
      (fun id => match LinkListToTupleOfLinksOption n ((TupleFunctionToLinkListFunction anet) id) with
        | some t => t
        | none => anet id) := by
  intro id
  simp [TupleFunctionToLinkListFunction]
  rw [LinkListToTupleOfLinksInverse]

-- Лемма о сохранении длины списков LinkList в ассоциативной сети дуплетов
theorem LinkListDimensionPreserved (offset : Nat) (np : LinkList) :
    np.length = (LinkListToDupletList_ offset np).length := by
  induction np generalizing offset with
  | nil => simp [LinkListToDupletList_]
  | cons n np' ih =>
    cases np' with
    | nil => simp [LinkListToDupletList_]
    | cons m np'' =>
      simp [LinkListToDupletList_]
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
Definition exampleTuple0 : TupleOfLinks 0 := [].
Definition exampleTuple1 : TupleOfLinks 1 := [0].
Definition exampleTuple4 : TupleOfLinks 4 := [3; 2; 1; 0].

(* Преобразование кортежей ссылок во вложенные упорядоченные пары (списки) *)
Definition nestedPair0 := TupleOfLinksToLinkList exampleTuple0.
Definition nestedPair1 := TupleOfLinksToLinkList exampleTuple1.
Definition nestedPair4 := TupleOfLinksToLinkList exampleTuple4.

Compute nestedPair0. (* Ожидается результат: { } *)
Compute nestedPair1. (* Ожидается результат: {0} *)
Compute nestedPair4. (* Ожидается результат: {3, 2, 1, 0} *)

(* Вычисление значений преобразованной функции трёхмерной ассоциативной сети *)
Compute (TupleFunctionToLinkListFunction complexExampleNetwork) 0. (* Ожидается результат: {0, 0, 0} *)
Compute (TupleFunctionToLinkListFunction complexExampleNetwork) 1. (* Ожидается результат: {1, 1, 2} *)
Compute (TupleFunctionToLinkListFunction complexExampleNetwork) 2. (* Ожидается результат: {2, 4, 0} *)
Compute (TupleFunctionToLinkListFunction complexExampleNetwork) 3. (* Ожидается результат: {3, 0, 5} *)
Compute (TupleFunctionToLinkListFunction complexExampleNetwork) 4. (* Ожидается результат: {4, 1, 1} *)
Compute (TupleFunctionToLinkListFunction complexExampleNetwork) 5. (* Ожидается результат: {0, 0, 0} *)

(* Ассоциативная сеть вложенных упорядоченных пар *)
Definition testPairsNetwork : AssociativeNetworkLinkListFunction :=
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
  LinkListFunctionToTupleFunction testPairsNetwork.

(* Вычисление значений преобразованной функции ассоциативной сети вложенных УП *)
Compute testTuplesNetwork 0. (* Ожидается результат: [5; 0; 8] *)
Compute testTuplesNetwork 1. (* Ожидается результат: [7; 1; 2] *)
Compute testTuplesNetwork 2. (* Ожидается результат: [2; 4; 5] *)
Compute testTuplesNetwork 3. (* Ожидается результат: [3; 1; 5] *)
Compute testTuplesNetwork 4. (* Ожидается результат: [4; 2; 1] *)
Compute testTuplesNetwork 5. (* Ожидается результат: [0; 0; 0] *)

(* Преобразование вложенных УП в ассоциативную сеть дуплетов *)
Compute LinkListToDupletList { 121, 21, 1343 }.
(* Должно вернуть: {(121, 1), (21, 2), (1343, 2)} *)

(* Добавление вложенных УП в ассоциативную сеть дуплетов *)
Compute AddLinkListToDupletList {(121, 1), (21, 2), (1343, 2)} {12, 23, 34}.
(* Ожидается результат: {(121, 1), (21, 2), (1343, 2), (12, 4), (23, 5), (34, 5)} *)

(* Преобразование ассоциативной сети дуплетов во вложенные УП *)
Compute DupletListToLinkList {(121, 1), (21, 2), (1343, 2)}.
(* Ожидается результат: {121, 21, 1343} *)

Compute DupletListToLinkList {(121, 1), (21, 2), (1343, 2), (12, 4), (23, 5), (34, 5)}.
(* Ожидается результат: {121, 21, 1343} *)

(* Чтение вложенных УП из ассоциативной сети дуплетов по индексу дуплета — начала вложенных УП *)
Compute DupletListReadLinkList {(121, 1), (21, 2), (1343, 2), (12, 4), (23, 5), (34, 5)} 0.
(* Ожидается результат: {121, 21, 1343} *)

Compute DupletListReadLinkList {(121, 1), (21, 2), (1343, 2), (12, 4), (23, 5), (34, 5)} 3.
(* Ожидается результат: {12, 23, 34} *)

(* Определяем ассоциативную сеть вложенных УП *)
Definition testLinkListList := { {121, 21, 1343}, {12, 23}, {34}, {121, 21, 1343}, {12, 23}, {34} }.

(* Преобразованная ассоциативная сеть вложенных УП в ассоциативную сеть дуплетов *)
Definition testDupletList := LinkListListToDupletList testLinkListList.

(* Вычисление преобразованной ассоциативной сети вложенных УП в ассоциативную сеть дуплетов *)
Compute testDupletList.
(* Ожидается результат:
 {(121, 1), (21, 2), (1343, 2),
  (12, 4), (23, 4),
  (34, 5),
  (121, 7), (21, 8), (1343, 8),
  (12, 10), (23, 10),
  (34, 11)} *)

(* Вычисление преобразования ассоциативной сети вложенных УП в ассоциативную сеть дуплетов и обратно в testLinkListList *)
Compute DupletListToLinkListList testDupletList.
(* Ожидается результат:
  {{121, 21, 1343}, {12, 23}, {34}, {121, 21, 1343}, {12, 23}, {34}} *)

(* Вычисление смещения вложенных УП в ассоциативной сети дуплетов по их порядковому номеру *)
Compute DupletListOffsetLinkList testDupletList 0. (* Ожидается результат: 0 *)
Compute DupletListOffsetLinkList testDupletList 1. (* Ожидается результат: 3 *)
Compute DupletListOffsetLinkList testDupletList 2. (* Ожидается результат: 5 *)
Compute DupletListOffsetLinkList testDupletList 3. (* Ожидается результат: 6 *)
Compute DupletListOffsetLinkList testDupletList 4. (* Ожидается результат: 9 *)
Compute DupletListOffsetLinkList testDupletList 5. (* Ожидается результат: 11 *)
Compute DupletListOffsetLinkList testDupletList 6. (* Ожидается результат: 12 *)
Compute DupletListOffsetLinkList testDupletList 7. (* Ожидается результат: 12 *)

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
  LinkListListToTupleList (DupletListToLinkListList testTuplesToDupletList).

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
#eval LinkListToDupletList [121, 21, 1343]
-- Должно вернуть: [(121, 1), (21, 2), (1343, 2)]

-- Добавление вложенных УП в ассоциативную сеть дуплетов
#eval AddLinkListToDupletList [(121, 1), (21, 2), (1343, 2)] [12, 23, 34]
-- Ожидается результат: [(121, 1), (21, 2), (1343, 2), (12, 4), (23, 5), (34, 5)]

-- Преобразование ассоциативной сети дуплетов во вложенные УП
#eval DupletListToLinkList [(121, 1), (21, 2), (1343, 2)]
-- Ожидается результат: [121, 21, 1343]

-- Определяем ассоциативную сеть вложенных УП
def testLinkListList : AssociativeNetworkLinkListList :=
  [[121, 21, 1343], [12, 23], [34], [121, 21, 1343], [12, 23], [34]]

-- Преобразование ассоциативной сети вложенных УП в ассоциативную сеть дуплетов и обратно
#eval DupletListToLinkListList (LinkListListToDupletList testLinkListList)
-- Ожидается результат:
-- [[121, 21, 1343], [12, 23], [34], [121, 21, 1343], [12, 23], [34]]

-- Определяем трёхмерную ассоциативную сеть как последовательность кортежей длины 3
def testTupleList : AssociativeNetworkTupleList 3 :=
  [#v[0, 0, 0], #v[1, 1, 2], #v[2, 4, 0], #v[3, 0, 5], #v[4, 1, 1], #v[0, 0, 0]]

-- Итоговая проверка эквивалентности ассоциативных сетей
def resultTuplesNetwork : AssociativeNetworkTupleList 3 :=
  LinkListListToTupleList (DupletListToLinkListList (TupleListToDupletList testTupleList))

#eval resultTuplesNetwork.map (·.toList)
-- Ожидается результат:
-- [[0, 0, 0], [1, 1, 2], [2, 4, 0], [3, 0, 5], [4, 1, 1], [0, 0, 0]]
```
